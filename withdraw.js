/* ============================================================
   CROWN CASH
   WITHDRAWAL CONTROLLER
   Automatic Registered Mobile Money Number
   ============================================================ */

(() => {
    "use strict";

    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const API_BASE = "https://crown-cash1.onrender.com";

    const PROFILE_API = `${API_BASE}/profile.php`;
    const WITHDRAW_API = `${API_BASE}/withdrawal.php`;

    const MIN_WITHDRAWAL = 5000;
    const WITHDRAWAL_FEE_RATE = 0.20;

    let currentUser = null;
    let registeredPhone = "";
    let availableBalance = 0;

    let isSubmitting = false;

    /* ============================================================
       DOM HELPERS
       ============================================================ */

    const $ = (id) => document.getElementById(id);

    const form = $("withdrawForm");
    const amountInput = $("amount");

    const balanceElement = $("availableBalance");

    const registeredPhoneElement = $("registeredPhone");
    const phoneInput = $("phone");

    const accountNameElement = $("accountName");

    const displayAmount = $("displayAmount");
    const withdrawalFee = $("withdrawalFee");
    const payoutAmount = $("payoutAmount");

    const confirmation = $("confirmWithdrawal");

    const withdrawButton = $("withdrawButton");

    const formMessage = $("formMessage");

    const withdrawalHistory = $("withdrawalHistory");

    /* ============================================================
       NUMBER HELPERS
       ============================================================ */

    function toNumber(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : 0;
        }

        if (value === null || value === undefined) {
            return 0;
        }

        const cleaned = String(value)
            .replace(/UGX/gi, "")
            .replace(/,/g, "")
            .replace(/\s/g, "")
            .trim();

        const number = Number(cleaned);

        return Number.isFinite(number) ? number : 0;
    }

    function formatUGX(value) {
        const amount = Math.max(0, Math.round(toNumber(value)));

        return `UGX ${amount.toLocaleString("en-UG")}`;
    }

    /* ============================================================
       PHONE HELPERS
       ============================================================ */

    function normalizeUgandaPhone(value) {
        let phone = String(value || "")
            .replace(/\s+/g, "")
            .replace(/-/g, "")
            .replace(/\(/g, "")
            .replace(/\)/g, "");

        if (!phone) {
            return "";
        }

        /* +256XXXXXXXXX -> 0XXXXXXXXX */
        if (phone.startsWith("+256")) {
            phone = "0" + phone.substring(4);
        }

        /* 256XXXXXXXXX -> 0XXXXXXXXX */
        if (phone.startsWith("256")) {
            phone = "0" + phone.substring(3);
        }

        /* Remove any remaining + */
        phone = phone.replace(/\+/g, "");

        return phone;
    }

    function isValidUgandaPhone(phone) {
        const normalized = normalizeUgandaPhone(phone);

        return /^07\d{8}$/.test(normalized);
    }

    /* ============================================================
       NAME HELPERS
       ============================================================ */

    function getUserName(user) {
        if (!user || typeof user !== "object") {
            return "";
        }

        const directNames = [
            user.full_name,
            user.fullName,
            user.name,
            user.display_name,
            user.displayName
        ];

        for (const value of directNames) {
            if (String(value || "").trim()) {
                return String(value).trim();
            }
        }

        const firstName =
            user.first_name ||
            user.firstName ||
            "";

        const lastName =
            user.last_name ||
            user.lastName ||
            "";

        const combined = `${firstName} ${lastName}`.trim();

        return combined;
    }

    /* ============================================================
       PHONE EXTRACTION
       ============================================================ */

    function getUserPhone(user) {
        if (!user || typeof user !== "object") {
            return "";
        }

        const possiblePhones = [
            user.phone,
            user.phone_number,
            user.phoneNumber,
            user.mobile,
            user.mobile_number,
            user.mobileNumber,
            user.registered_phone,
            user.registeredPhone
        ];

        for (const value of possiblePhones) {
            const normalized = normalizeUgandaPhone(value);

            if (normalized) {
                return normalized;
            }
        }

        return "";
    }

    /* ============================================================
       RESPONSE HELPERS
       ============================================================ */

    async function parseResponse(response) {
        const text = await response.text();

        if (!text) {
            return {};
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            return {
                success: false,
                message: text
            };
        }
    }

    function extractData(response) {
        if (!response || typeof response !== "object") {
            return {};
        }

        if (
            response.data &&
            typeof response.data === "object"
        ) {
            return response.data;
        }

        return response;
    }

    /* ============================================================
       MESSAGE DISPLAY
       ============================================================ */

    function clearMessage() {
        if (!formMessage) {
            return;
        }

        formMessage.textContent = "";
        formMessage.style.display = "none";
        formMessage.style.color = "";
        formMessage.style.background = "";
        formMessage.style.border = "";
        formMessage.style.padding = "";
        formMessage.style.borderRadius = "";
    }

    function showMessage(message, type = "error") {
        if (!formMessage) {
            return;
        }

        formMessage.textContent = message;
        formMessage.style.display = "block";
        formMessage.style.padding = "9px 10px";
        formMessage.style.borderRadius = "8px";

        if (type === "success") {
            formMessage.style.color = "#8ff0b4";
            formMessage.style.background =
                "rgba(65,229,138,.07)";
            formMessage.style.border =
                "1px solid rgba(65,229,138,.18)";
        } else {
            formMessage.style.color = "#ff9b9b";
            formMessage.style.background =
                "rgba(255,70,70,.07)";
            formMessage.style.border =
                "1px solid rgba(255,70,70,.18)";
        }
    }

    /* ============================================================
       LOADING STATE
       ============================================================ */

    function setButtonState(loading) {
        if (!withdrawButton) {
            return;
        }

        withdrawButton.disabled = loading;

        if (loading) {
            withdrawButton.dataset.originalText =
                withdrawButton.textContent;

            withdrawButton.textContent =
                "Submitting Request...";
        } else {
            withdrawButton.textContent =
                withdrawButton.dataset.originalText ||
                "Submit Withdrawal Request";
        }
    }

    /* ============================================================
       FETCH PROFILE
       ============================================================ */

    async function loadProfile() {
        try {
            const response = await fetch(PROFILE_API, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            const data = await parseResponse(response);

            if (response.status === 401) {
                window.location.href =
                    "/login.html?redirect=withdraw";
                return null;
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to load your Crown Cash profile."
                );
            }

            if (
                data.success === false &&
                !data.user &&
                !data.data
            ) {
                throw new Error(
                    data.message ||
                    "Unable to load your profile."
                );
            }

            const profileData = extractData(data);

            const user =
                profileData.user ||
                profileData.profile ||
                profileData;

            if (!user || typeof user !== "object") {
                throw new Error(
                    "Your profile information could not be loaded."
                );
            }

            currentUser = user;

            return user;

        } catch (error) {

            console.error(
                "Crown Cash profile error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to load your Crown Cash profile."
            );

            return null;
        }
    }

    /* ============================================================
       DISPLAY PROFILE
       ============================================================ */

    function displayProfile(user) {
        if (!user) {
            return false;
        }

        /* --------------------------------------------------------
           PHONE
           -------------------------------------------------------- */

        registeredPhone = getUserPhone(user);

        if (!registeredPhone) {

            if (registeredPhoneElement) {
                registeredPhoneElement.textContent =
                    "Number unavailable";
            }

            if (phoneInput) {
                phoneInput.value = "";
            }

        } else {

            if (registeredPhoneElement) {
                registeredPhoneElement.textContent =
                    registeredPhone;
            }

            if (phoneInput) {
                phoneInput.value =
                    registeredPhone;
            }
        }

        /* --------------------------------------------------------
           ACCOUNT NAME
           -------------------------------------------------------- */

        const name = getUserName(user);

        if (accountNameElement) {
            accountNameElement.textContent =
                name || "Crown Cash Member";
        }

        /* --------------------------------------------------------
           BALANCE
           -------------------------------------------------------- */

        const balance =
            user.balance ??
            user.wallet_balance ??
            user.walletBalance ??
            user.available_balance ??
            user.availableBalance ??
            0;

        availableBalance = toNumber(balance);

        if (balanceElement) {
            balanceElement.textContent =
                formatUGX(availableBalance);
        }

        return true;
    }

    /* ============================================================
       CALCULATE WITHDRAWAL
       ============================================================ */

    function calculateWithdrawal() {

        if (!amountInput) {
            return;
        }

        const amount = toNumber(
            amountInput.value
        );

        if (!amount || amount <= 0) {

            if (displayAmount) {
                displayAmount.textContent =
                    "UGX 0";
            }

            if (withdrawalFee) {
                withdrawalFee.textContent =
                    "UGX 0";
            }

            if (payoutAmount) {
                payoutAmount.textContent =
                    "UGX 0";
            }

            return;
        }

        const fee =
            Math.round(
                amount * WITHDRAWAL_FEE_RATE
            );

        const payout =
            Math.max(
                0,
                amount - fee
            );

        if (displayAmount) {
            displayAmount.textContent =
                formatUGX(amount);
        }

        if (withdrawalFee) {
            withdrawalFee.textContent =
                formatUGX(fee);
        }

        if (payoutAmount) {
            payoutAmount.textContent =
                formatUGX(payout);
        }
    }

    /* ============================================================
       VALIDATE FORM
       ============================================================ */

    function validateForm() {

        const amount = toNumber(
            amountInput ? amountInput.value : 0
        );

        if (!amount || amount <= 0) {
            return "Please enter the withdrawal amount.";
        }

        if (!Number.isInteger(amount)) {
            return "Withdrawal amount must be a whole number.";
        }

        if (amount < MIN_WITHDRAWAL) {
            return `Minimum withdrawal is ${formatUGX(MIN_WITHDRAWAL)}.`;
        }

        if (amount > availableBalance) {
            return "Withdrawal amount cannot exceed your available wallet balance.";
        }

        /* --------------------------------------------------------
           REGISTERED PHONE
           -------------------------------------------------------- */

        const phone =
            normalizeUgandaPhone(
                registeredPhone ||
                (phoneInput ? phoneInput.value : "")
            );

        if (!phone) {
            return "Your registered Mobile Money number could not be loaded.";
        }

        if (!isValidUgandaPhone(phone)) {
            return "Your registered Mobile Money number is invalid. Please update your profile.";
        }

        /* --------------------------------------------------------
           CONFIRMATION
           -------------------------------------------------------- */

        if (
            confirmation &&
            !confirmation.checked
        ) {
            return "Please confirm that your withdrawal details are correct.";
        }

        return "";
    }

    /* ============================================================
       SUBMIT WITHDRAWAL
       ============================================================ */

    async function submitWithdrawal(event) {

        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        clearMessage();

        const validationError =
            validateForm();

        if (validationError) {

            showMessage(
                validationError,
                "error"
            );

            return;
        }

        const amount = toNumber(
            amountInput.value
        );

        const phone =
            normalizeUgandaPhone(
                registeredPhone
            );

        /* --------------------------------------------------------
           FINAL PHONE SAFETY CHECK
           -------------------------------------------------------- */

        if (!phone || !isValidUgandaPhone(phone)) {

            showMessage(
                "Your registered Mobile Money number is unavailable or invalid.",
                "error"
            );

            return;
        }

        /* --------------------------------------------------------
           CONFIRMATION
           -------------------------------------------------------- */

        const confirmed =
            window.confirm(
                `Submit a withdrawal request for ${formatUGX(amount)} to your registered Mobile Money number ${phone}?\n\nYour wallet will NOT be deducted until an authorized administrator approves the request.`
            );

        if (!confirmed) {
            return;
        }

        isSubmitting = true;

        setButtonState(true);

        try {

            /* ----------------------------------------------------
               IMPORTANT:
               No payment_method is sent.
               The registered phone is used automatically.
               ---------------------------------------------------- */

            const payload = {
                amount: amount,
                phone: phone
            };

            const response = await fetch(
                WITHDRAW_API,
                {
                    method: "POST",
                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            const data =
                await parseResponse(response);

            /* ----------------------------------------------------
               AUTHENTICATION
               ---------------------------------------------------- */

            if (response.status === 401) {

                window.location.href =
                    "/login.html?redirect=withdraw";

                return;
            }

            /* ----------------------------------------------------
               ERROR
               ---------------------------------------------------- */

            if (
                !response.ok ||
                data.success === false
            ) {

                throw new Error(
                    data.message ||
                    data.error ||
                    "Withdrawal request could not be submitted."
                );
            }

            /* ----------------------------------------------------
               SUCCESS
               ---------------------------------------------------- */

            showMessage(
                data.message ||
                "Withdrawal request submitted successfully. Your wallet remains unchanged until administrator approval.",
                "success"
            );

            /* ----------------------------------------------------
               IMPORTANT:
               Do NOT reduce availableBalance here.
               The wallet remains unchanged until admin approval.
               ---------------------------------------------------- */

            const responseData =
                extractData(data);

            if (
                responseData.wallet &&
                responseData.wallet.balance !== undefined
            ) {

                availableBalance =
                    toNumber(
                        responseData.wallet.balance
                    );

            } else if (
                responseData.balance !== undefined
            ) {

                availableBalance =
                    toNumber(
                        responseData.balance
                    );
            }

            if (balanceElement) {

                balanceElement.textContent =
                    formatUGX(
                        availableBalance
                    );
            }

            /* ----------------------------------------------------
               RESET FORM
               ---------------------------------------------------- */

            if (form) {
                form.reset();
            }

            /* Restore hidden registered phone */
            if (phoneInput) {
                phoneInput.value =
                    registeredPhone;
            }

            calculateWithdrawal();

            /* ----------------------------------------------------
               REFRESH PROFILE
               ---------------------------------------------------- */

            const updatedUser =
                await loadProfile();

            if (updatedUser) {
                displayProfile(updatedUser);
            }

            /* ----------------------------------------------------
               LOAD HISTORY
               ---------------------------------------------------- */

            await loadWithdrawalHistory();

        } catch (error) {

            console.error(
                "Crown Cash withdrawal error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to submit withdrawal request.",
                "error"
            );

        } finally {

            isSubmitting = false;

            setButtonState(false);
        }
    }

    /* ============================================================
       WITHDRAWAL HISTORY
       ============================================================ */

    async function loadWithdrawalHistory() {

        if (!withdrawalHistory) {
            return;
        }

        /*
         * We intentionally do not assume a separate history endpoint.
         * If withdrawal.php supports GET for the logged-in user,
         * use it.
         */

        try {

            const response =
                await fetch(
                    WITHDRAW_API,
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

            const data =
                await parseResponse(response);

            if (response.status === 401) {
                return;
            }

            if (!response.ok) {
                return;
            }

            const responseData =
                extractData(data);

            const withdrawals =
                responseData.withdrawals ||
                responseData.data ||
                [];

            if (!Array.isArray(withdrawals)) {
                return;
            }

            renderWithdrawalHistory(
                withdrawals
            );

        } catch (error) {

            console.warn(
                "Withdrawal history could not be loaded:",
                error
            );

        }
    }

    /* ============================================================
       HISTORY RENDERER
       ============================================================ */

    function renderWithdrawalHistory(items) {

        if (!withdrawalHistory) {
            return;
        }

        if (!items.length) {

            withdrawalHistory.innerHTML =
                "No withdrawal requests yet";

            withdrawalHistory.className =
                "history-empty";

            return;
        }

        const recent =
            items.slice(0, 10);

        withdrawalHistory.className =
            "withdrawal-history-list";

        withdrawalHistory.innerHTML =
            recent.map(
                (item) => {

                    const amount =
                        toNumber(
                            item.amount ??
                            item.withdrawal_amount ??
                            0
                        );

                    const status =
                        String(
                            item.status ||
                            item.withdrawal_status ||
                            "pending"
                        );

                    const normalizedStatus =
                        status.toLowerCase();

                    let statusClass =
                        "pending";

                    if (
                        normalizedStatus.includes(
                            "approved"
                        )
                    ) {
                        statusClass =
                            "approved";
                    } else if (
                        normalizedStatus.includes(
                            "reject"
                        )
                    ) {
                        statusClass =
                            "rejected";
                    } else if (
                        normalizedStatus.includes(
                            "processing"
                        )
                    ) {
                        statusClass =
                            "processing";
                    }

                    const date =
                        item.created_at ||
                        item.createdAt ||
                        item.date ||
                        item.requested_at ||
                        "";

                    const formattedDate =
                        formatDate(date);

                    return `
                        <div
                            style="
                                display:flex;
                                align-items:center;
                                justify-content:space-between;
                                gap:10px;
                                padding:10px;
                                margin-bottom:7px;
                                border:1px solid rgba(255,255,255,.06);
                                border-radius:9px;
                                background:rgba(255,255,255,.018);
                            "
                        >

                            <div>

                                <div
                                    style="
                                        color:#fff;
                                        font-size:11px;
                                        font-weight:800;
                                    "
                                >
                                    ${escapeHtml(
                                        formatUGX(amount)
                                    )}
                                </div>

                                <div
                                    style="
                                        margin-top:3px;
                                        color:#756b76;
                                        font-size:8px;
                                    "
                                >
                                    ${escapeHtml(
                                        formattedDate
                                    )}
                                </div>

                            </div>

                            <div
                                class="withdraw-status ${statusClass}"
                                style="
                                    padding:5px 8px;
                                    border-radius:7px;
                                    font-size:8px;
                                    font-weight:800;
                                    text-transform:uppercase;
                                "
                            >
                                ${escapeHtml(
                                    status.replace(
                                        /_/g,
                                        " "
                                    )
                                )}
                            </div>

                        </div>
                    `;
                }
            ).join("");

        applyHistoryStatusStyles();
    }

    /* ============================================================
       DATE
       ============================================================ */

    function formatDate(value) {

        if (!value) {
            return "Date not available";
        }

        let date;

        if (
            typeof value === "object" &&
            value.$date
        ) {
            date =
                new Date(
                    value.$date
                );
        } else {
            date =
                new Date(value);
        }

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "Date not available";
        }

        return date.toLocaleString(
            "en-UG",
            {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    /* ============================================================
       HISTORY STATUS STYLES
       ============================================================ */

    function applyHistoryStatusStyles() {

        const styles =
            document.createElement("style");

        styles.textContent = `
            .withdraw-status.pending {
                color:#f3d66b;
                background:rgba(243,214,107,.08);
                border:1px solid rgba(243,214,107,.12);
            }

            .withdraw-status.processing {
                color:#d47cff;
                background:rgba(198,0,255,.08);
                border:1px solid rgba(198,0,255,.12);
            }

            .withdraw-status.approved {
                color:#7fe5a8;
                background:rgba(65,229,138,.08);
                border:1px solid rgba(65,229,138,.12);
            }

            .withdraw-status.rejected {
                color:#ff9292;
                background:rgba(255,70,70,.08);
                border:1px solid rgba(255,70,70,.12);
            }
        `;

        document.head.appendChild(styles);
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
       EVENT LISTENERS
       ============================================================ */

    if (amountInput) {

        amountInput.addEventListener(
            "input",
            calculateWithdrawal
        );

        amountInput.addEventListener(
            "change",
            calculateWithdrawal
        );
    }

    if (form) {

        form.addEventListener(
            "submit",
            submitWithdrawal
        );
    }

    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initialize() {

        clearMessage();

        calculateWithdrawal();

        const user =
            await loadProfile();

        if (!user) {
            return;
        }

        displayProfile(user);

        await loadWithdrawalHistory();

        calculateWithdrawal();
    }

    initialize();

})();