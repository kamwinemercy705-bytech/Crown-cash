/* ============================================================
   CROWN CASH — ADMIN WITHDRAWALS
   Complete frontend controller
   ============================================================ */

(() => {
    "use strict";

    /* ------------------------------------------------------------
       API
       IMPORTANT:
       Backend file is admin_withdrawal.php
       ------------------------------------------------------------ */

    const API_URL =
        "https://crown-cash1.onrender.com/admin_withdrawal.php";

    /* ------------------------------------------------------------
       State
       ------------------------------------------------------------ */

    let withdrawals = [];

    let currentStatus = "";
    let currentMethod = "";
    let currentPayoutStatus = "";

    let refreshTimer = null;
    let isLoading = false;

    /* ------------------------------------------------------------
       DOM helpers
       ------------------------------------------------------------ */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {
        const number = Number(value || 0);

        return "UGX " + number.toLocaleString("en-US", {
            maximumFractionDigits: 0
        });
    }

    function getValue(obj, ...keys) {
        for (const key of keys) {
            if (
                obj &&
                obj[key] !== undefined &&
                obj[key] !== null &&
                obj[key] !== ""
            ) {
                return obj[key];
            }
        }

        return "";
    }

    /* ------------------------------------------------------------
       Toast notification
       ------------------------------------------------------------ */

    function showToast(message, type = "success") {
        let toast =
            document.getElementById("cc-admin-toast");

        if (!toast) {
            toast = document.createElement("div");

            toast.id = "cc-admin-toast";

            toast.style.position = "fixed";
            toast.style.right = "20px";
            toast.style.bottom = "20px";
            toast.style.zIndex = "99999";
            toast.style.maxWidth = "380px";
            toast.style.padding = "14px 18px";
            toast.style.borderRadius = "14px";
            toast.style.fontSize = "14px";
            toast.style.fontWeight = "700";
            toast.style.lineHeight = "1.45";
            toast.style.backdropFilter = "blur(18px)";
            toast.style.webkitBackdropFilter =
                "blur(18px)";
            toast.style.boxShadow =
                "0 12px 35px rgba(0,0,0,.35)";
            toast.style.transition =
                "opacity .25s ease";

            document.body.appendChild(toast);
        }

        toast.textContent = message;

        if (type === "error") {
            toast.style.background =
                "rgba(120, 20, 55, .95)";

            toast.style.border =
                "1px solid rgba(255, 100, 130, .45)";

            toast.style.color = "#ffd7df";
        } else {
            toast.style.background =
                "rgba(45, 30, 75, .96)";

            toast.style.border =
                "1px solid rgba(255, 210, 80, .45)";

            toast.style.color = "#ffe89a";
        }

        toast.style.opacity = "1";

        clearTimeout(window.__ccToastTimer);

        window.__ccToastTimer = setTimeout(() => {
            toast.style.opacity = "0";
        }, 4000);
    }

    /* ------------------------------------------------------------
       Get useful server error
       ------------------------------------------------------------ */

    function extractServerError(data, rawText, status) {
        if (data && typeof data === "object") {
            const possibleMessages = [
                data.message,
                data.error,
                data.details,
                data.reason,
                data.exception,
                data.description
            ];

            for (const message of possibleMessages) {
                if (
                    message !== undefined &&
                    message !== null &&
                    String(message).trim() !== ""
                ) {
                    return String(message);
                }
            }
        }

        if (
            rawText &&
            String(rawText).trim() !== ""
        ) {
            return String(rawText).trim();
        }

        return `Server returned HTTP ${status}`;
    }

    /* ------------------------------------------------------------
       API request
       ------------------------------------------------------------ */

    async function apiRequest(options = {}) {
        const method =
            options.method || "GET";

        const body =
            options.body || null;

        const url =
            options.url || API_URL;

        const fetchOptions = {
            method,
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json",
                "Cache-Control": "no-cache"
            }
        };

        if (body) {
            fetchOptions.headers[
                "Content-Type"
            ] = "application/json";

            fetchOptions.body =
                JSON.stringify(body);
        }

        let response;

        try {
            response = await fetch(
                url,
                fetchOptions
            );
        } catch (networkError) {
            throw new Error(
                "Unable to connect to the Crown Cash server. " +
                "Please check your internet connection and try again."
            );
        }

        const rawText =
            await response.text();

        let data = {};

        if (rawText.trim() !== "") {
            try {
                data = JSON.parse(rawText);
            } catch (parseError) {
                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}: ` +
                        rawText.substring(0, 500)
                    );
                }

                throw new Error(
                    "The server returned an invalid response."
                );
            }
        }

        if (!response.ok) {
            throw new Error(
                extractServerError(
                    data,
                    rawText,
                    response.status
                )
            );
        }

        if (
            data &&
            (
                data.success === false ||
                data.ok === false
            )
        ) {
            throw new Error(
                extractServerError(
                    data,
                    rawText,
                    response.status
                )
            );
        }

        return data;
    }

    /* ------------------------------------------------------------
       Find main withdrawal container
       ------------------------------------------------------------ */

    function findWithdrawalContainer() {
        const possibleSelectors = [
            "#withdrawalRequests",
            "#withdrawal-requests",
            "#withdrawalsList",
            "#withdrawals-list",
            "#withdrawalList",
            "#withdrawal-list",
            "#withdrawalContainer",
            "#withdrawalsContainer",
            ".withdrawal-requests",
            ".withdrawals-list",
            ".withdrawal-list",
            "[data-withdrawals]",
            "[data-withdrawal-list]"
        ];

        for (const selector of possibleSelectors) {
            const element = $(selector);

            if (element) {
                return element;
            }
        }

        const candidates = $$(
            "main section, main div, section, .card, .panel"
        );

        for (const element of candidates) {
            const text =
                element.textContent || "";

            if (
                text.includes(
                    "No withdrawal requests"
                ) ||
                text.includes(
                    "Withdrawal Requests"
                ) ||
                text.includes(
                    "Unable to load withdrawal"
                )
            ) {
                return element;
            }
        }

        return null;
    }

    /* ------------------------------------------------------------
       Normalize MongoDB ObjectId
       ------------------------------------------------------------ */

    function normalizeId(value) {
        if (!value) {
            return "";
        }

        if (
            typeof value === "object" &&
            value.$oid
        ) {
            return String(value.$oid);
        }

        if (
            typeof value === "object" &&
            value.oid
        ) {
            return String(value.oid);
        }

        return String(value);
    }

    /* ------------------------------------------------------------
       Normalize withdrawal
       ------------------------------------------------------------ */

    function normalizeWithdrawal(item) {
        item = item || {};

        const rawId =
            getValue(
                item,
                "_id",
                "id",
                "withdrawal_id",
                "withdrawalId"
            );

        return {
            id: normalizeId(rawId),

            reference: getValue(
                item,
                "reference",
                "withdrawal_reference",
                "withdrawalReference"
            ),

            userId: normalizeId(
                getValue(
                    item,
                    "user_id",
                    "userId",
                    "member_id",
                    "memberId"
                )
            ),

            name: getValue(
                item,
                "name",
                "full_name",
                "fullName",
                "user_name",
                "userName",
                "customer_name",
                "customerName"
            ) || "Unknown Customer",

            phone: getValue(
                item,
                "phone",
                "mobile",
                "mobile_number",
                "mobileNumber",
                "withdrawal_number",
                "withdrawalNumber",
                "registered_phone"
            ) || "Not available",

            email: getValue(
                item,
                "email",
                "user_email",
                "userEmail"
            ),

            accountName: getValue(
                item,
                "account_name",
                "accountName",
                "name",
                "full_name"
            ),

            amount: Number(
                getValue(
                    item,
                    "amount",
                    "requested_amount",
                    "requestedAmount"
                ) || 0
            ),

            fee: Number(
                getValue(
                    item,
                    "fee",
                    "withdrawal_fee",
                    "withdrawalFee"
                ) || 0
            ),

            net: Number(
                getValue(
                    item,
                    "net",
                    "net_amount",
                    "netAmount",
                    "payout",
                    "payout_amount",
                    "payoutAmount"
                ) || 0
            ),

            method: getValue(
                item,
                "method",
                "network",
                "payment_method",
                "paymentMethod"
            ) || "unknown",

            status: String(
                getValue(
                    item,
                    "status",
                    "withdrawal_status",
                    "withdrawalStatus"
                ) || "pending"
            ).toLowerCase(),

            payoutStatus: String(
                getValue(
                    item,
                    "payout_status",
                    "payoutStatus"
                ) || "not_required"
            ).toLowerCase(),

            rejectionReason: getValue(
                item,
                "rejection_reason",
                "rejectionReason"
            ),

            createdAt: getValue(
                item,
                "created_at",
                "createdAt",
                "date",
                "created"
            ),

            approvedAt: getValue(
                item,
                "approved_at",
                "approvedAt"
            ),

            rejectedAt: getValue(
                item,
                "rejected_at",
                "rejectedAt"
            )
        };
    }

    /* ------------------------------------------------------------
       Format dates
       ------------------------------------------------------------ */

    function formatDate(value) {
        if (!value) {
            return "Date unavailable";
        }

        if (
            typeof value === "object" &&
            value.$date
        ) {
            value = value.$date;
        }

        try {
            const date =
                new Date(value);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return String(value);
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
        } catch (error) {
            return String(value);
        }
    }

    /* ------------------------------------------------------------
       Method label
       ------------------------------------------------------------ */

    function methodLabel(method) {
        const value =
            String(method || "")
                .toLowerCase()
                .trim();

        if (value === "mtn") {
            return "MTN Mobile Money";
        }

        if (value === "airtel") {
            return "Airtel Money";
        }

        if (
            value === "mtn mobile money" ||
            value === "mtn_mobile_money"
        ) {
            return "MTN Mobile Money";
        }

        if (
            value === "airtel money" ||
            value === "airtel_money"
        ) {
            return "Airtel Money";
        }

        return method
            ? String(method)
            : "Method unknown";
    }

    /* ------------------------------------------------------------
       Payout label
       ------------------------------------------------------------ */

    function payoutLabel(status) {
        const value =
            String(status || "")
                .toLowerCase()
                .trim();

        switch (value) {
            case "awaiting_payout":
                return "Awaiting Payout";

            case "paid":
                return "Paid";

            case "payout_failed":
                return "Payout Failed";

            case "processing":
                return "Processing";

            case "not_required":
                return "Not Required";

            default:
                return String(status || "Not Required");
        }
    }

    /* ------------------------------------------------------------
       Status badge
       ------------------------------------------------------------ */

    function statusBadge(status) {
        const value =
            String(status || "pending")
                .toLowerCase()
                .trim();

        let label = "Pending";
        let className = "pending";

        if (value === "approved") {
            label = "Approved";
            className = "approved";
        } else if (value === "rejected") {
            label = "Rejected";
            className = "rejected";
        } else if (value === "cancelled") {
            label = "Cancelled";
            className = "cancelled";
        } else if (
            value === "processing" ||
            value === "awaiting_approval"
        ) {
            label = "Processing";
            className = "processing";
        }

        return `
            <span class="cc-status-badge ${className}">
                <span class="cc-status-dot"></span>
                ${escapeHTML(label)}
            </span>
        `;
    }

    /* ------------------------------------------------------------
       Action buttons
       ------------------------------------------------------------ */

    function actionButtons(withdrawal) {
        const status =
            String(
                withdrawal.status || ""
            ).toLowerCase();

        if (
            status !== "pending" &&
            status !== "awaiting_approval" &&
            status !== "processing"
        ) {
            return `
                <div class="cc-action-state">
                    ${statusBadge(status)}
                </div>
            `;
        }

        return `
            <div class="cc-withdrawal-actions">

                <button
                    type="button"
                    class="cc-withdraw-action cc-approve-btn"
                    data-withdrawal-id="${escapeHTML(withdrawal.id)}"
                    data-action="approve"
                >
                    <span class="cc-btn-icon">
                        ✓
                    </span>

                    <span>Approve</span>
                </button>

                <button
                    type="button"
                    class="cc-withdraw-action cc-reject-btn"
                    data-withdrawal-id="${escapeHTML(withdrawal.id)}"
                    data-action="reject"
                >
                    <span class="cc-btn-icon">
                        ✕
                    </span>

                    <span>Reject</span>
                </button>

            </div>
        `;
    }

    /* ------------------------------------------------------------
       Withdrawal card
       ------------------------------------------------------------ */

    function withdrawalCard(withdrawal) {
        const safeId =
            escapeHTML(withdrawal.id);

        return `
            <article
                class="cc-withdrawal-card"
                data-withdrawal-card="${safeId}"
                data-withdrawal-id="${safeId}"
            >

                <div class="cc-withdrawal-top">

                    <div class="cc-customer">

                        <div class="cc-customer-icon">
                            👤
                        </div>

                        <div>
                            <h3>
                                ${escapeHTML(
                                    withdrawal.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    withdrawal.phone
                                )}
                            </p>

                            ${
                                withdrawal.email
                                    ? `
                                    <small>
                                        ${escapeHTML(
                                            withdrawal.email
                                        )}
                                    </small>
                                    `
                                    : ""
                            }
                        </div>

                    </div>

                    <div class="cc-status-area">
                        ${statusBadge(
                            withdrawal.status
                        )}
                    </div>

                </div>

                <div class="cc-withdrawal-details">

                    <div class="cc-detail-box">
                        <span class="cc-detail-label">
                            Requested
                        </span>

                        <strong>
                            ${money(
                                withdrawal.amount
                            )}
                        </strong>
                    </div>

                    <div class="cc-detail-box">
                        <span class="cc-detail-label">
                            Fee
                        </span>

                        <strong>
                            ${money(
                                withdrawal.fee
                            )}
                        </strong>
                    </div>

                    <div class="cc-detail-box">
                        <span class="cc-detail-label">
                            Payout
                        </span>

                        <strong>
                            ${money(
                                withdrawal.net
                            )}
                        </strong>
                    </div>

                    <div class="cc-detail-box">
                        <span class="cc-detail-label">
                            Method
                        </span>

                        <strong>
                            ${escapeHTML(
                                methodLabel(
                                    withdrawal.method
                                )
                            )}
                        </strong>
                    </div>

                    <div class="cc-detail-box">
                        <span class="cc-detail-label">
                            Payout Status
                        </span>

                        <strong>
                            ${escapeHTML(
                                payoutLabel(
                                    withdrawal.payoutStatus
                                )
                            )}
                        </strong>
                    </div>

                    <div class="cc-detail-box">
                        <span class="cc-detail-label">
                            Requested
                        </span>

                        <strong>
                            ${escapeHTML(
                                formatDate(
                                    withdrawal.createdAt
                                )
                            )}
                        </strong>
                    </div>

                </div>

                ${
                    withdrawal.reference
                        ? `
                        <div class="cc-reference">
                            <span>Reference:</span>

                            <strong>
                                ${escapeHTML(
                                    withdrawal.reference
                                )}
                            </strong>
                        </div>
                        `
                        : ""
                }

                ${
                    withdrawal.rejectionReason
                        ? `
                        <div class="cc-rejection-reason">
                            <strong>
                                Rejection reason
                            </strong>

                            <span>
                                ${escapeHTML(
                                    withdrawal.rejectionReason
                                )}
                            </span>
                        </div>
                        `
                        : ""
                }

                <div class="cc-withdrawal-footer">

                    <div class="cc-account-info">

                        <span>
                            Registered account:
                        </span>

                        <strong>
                            ${escapeHTML(
                                withdrawal.accountName ||
                                withdrawal.name
                            )}
                        </strong>

                    </div>

                    ${actionButtons(
                        withdrawal
                    )}

                </div>

            </article>
        `;
    }

    /* ------------------------------------------------------------
       Render withdrawals
       ------------------------------------------------------------ */

    function renderWithdrawals(list) {
        const container =
            findWithdrawalContainer();

        if (!container) {
            console.warn(
                "Crown Cash: withdrawal container not found."
            );

            return;
        }

        if (!list.length) {
            container.innerHTML = `
                <div class="cc-empty-withdrawals">

                    <div class="cc-empty-icon">
                        ↓
                    </div>

                    <h3>
                        No withdrawal requests
                    </h3>

                    <p>
                        There are no withdrawal requests
                        matching your filters.
                    </p>

                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="cc-withdrawals-grid">
                ${list
                    .map(withdrawalCard)
                    .join("")}
            </div>
        `;
    }

    /* ------------------------------------------------------------
       Render loading state
       ------------------------------------------------------------ */

    function renderLoading() {
        const container =
            findWithdrawalContainer();

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="cc-empty-withdrawals">

                <div class="cc-loading-spinner"></div>

                <h3>
                    Loading withdrawal requests...
                </h3>

                <p>
                    Please wait.
                </p>

            </div>
        `;
    }

    /* ------------------------------------------------------------
       Render error state
       ------------------------------------------------------------ */

    function renderError(error) {
        const container =
            findWithdrawalContainer();

        if (!container) {
            return;
        }

        const message =
            error?.message ||
            "Please refresh and try again.";

        container.innerHTML = `
            <div class="cc-empty-withdrawals cc-withdrawal-error">

                <div class="cc-empty-icon">
                    !
                </div>

                <h3>
                    Unable to load withdrawal requests
                </h3>

                <p>
                    ${escapeHTML(message)}
                </p>

                <button
                    type="button"
                    id="ccRetryWithdrawals"
                    class="cc-retry-btn"
                >
                    Retry
                </button>

            </div>
        `;

        const retryButton =
            document.getElementById(
                "ccRetryWithdrawals"
            );

        if (retryButton) {
            retryButton.addEventListener(
                "click",
                () => {
                    loadWithdrawals();
                }
            );
        }
    }

    /* ------------------------------------------------------------
       Stats
       ------------------------------------------------------------ */

    function updateStats(data) {
        const stats =
            data?.stats ||
            data?.statistics ||
            {};

        const total = Number(
            getValue(
                stats,
                "total",
                "total_withdrawals",
                "totalWithdrawals",
                "total_amount",
                "totalAmount"
            ) || 0
        );

        const pending = Number(
            getValue(
                stats,
                "pending",
                "pending_requests",
                "pendingRequests",
                "pending_amount",
                "pendingAmount"
            ) || 0
        );

        const approved = Number(
            getValue(
                stats,
                "approved",
                "approved_withdrawals",
                "approvedWithdrawals",
                "approved_amount",
                "approvedAmount"
            ) || 0
        );

        const rejected = Number(
            getValue(
                stats,
                "rejected",
                "rejected_withdrawals",
                "rejectedWithdrawals",
                "rejected_amount",
                "rejectedAmount"
            ) || 0
        );

        const statElements =
            $$("[data-withdrawal-stat]");

        statElements.forEach(
            (element) => {
                const type =
                    element
                        .getAttribute(
                            "data-withdrawal-stat"
                        )
                        ?.toLowerCase();

                if (type === "total") {
                    element.textContent =
                        money(total);
                }

                if (type === "pending") {
                    element.textContent =
                        money(pending);
                }

                if (type === "approved") {
                    element.textContent =
                        money(approved);
                }

                if (type === "rejected") {
                    element.textContent =
                        money(rejected);
                }
            }
        );

        const possible = {
            total: [
                "#totalWithdrawals",
                "#total-withdrawals",
                "#totalWithdrawalAmount"
            ],

            pending: [
                "#pendingWithdrawals",
                "#pending-withdrawals",
                "#pendingRequests"
            ],

            approved: [
                "#approvedWithdrawals",
                "#approved-withdrawals"
            ],

            rejected: [
                "#rejectedWithdrawals",
                "#rejected-withdrawals"
            ]
        };

        Object.entries(possible)
            .forEach(
                ([type, selectors]) => {
                    for (
                        const selector
                        of selectors
                    ) {
                        const element =
                            $(selector);

                        if (!element) {
                            continue;
                        }

                        const value =
                            type === "total"
                                ? total
                                : type === "pending"
                                ? pending
                                : type === "approved"
                                ? approved
                                : rejected;

                        element.textContent =
                            money(value);

                        break;
                    }
                }
            );
    }

    /* ------------------------------------------------------------
       Inject styles
       ------------------------------------------------------------ */

    function injectStyles() {
        if (
            document.getElementById(
                "cc-admin-withdrawal-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "cc-admin-withdrawal-styles";

        style.textContent = `
            .cc-withdrawals-grid {
                display: grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(320px, 1fr));
                gap: 16px;
                width: 100%;
            }

            .cc-withdrawal-card {
                position: relative;
                padding: 18px;
                border-radius: 18px;
                background:
                    linear-gradient(
                        145deg,
                        rgba(52, 18, 55, .72),
                        rgba(20, 12, 30, .88)
                    );
                border:
                    1px solid rgba(255, 210, 80, .16);
                box-shadow:
                    0 12px 35px rgba(0,0,0,.18);
                overflow: hidden;
            }

            .cc-withdrawal-top {
                position: relative;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 14px;
                margin-bottom: 18px;
            }

            .cc-customer {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
            }

            .cc-customer-icon {
                width: 46px;
                height: 46px;
                min-width: 46px;
                display: grid;
                place-items: center;
                border-radius: 50%;
                color: #ffd66d;
                background:
                    radial-gradient(
                        circle,
                        rgba(255, 210, 80, .17),
                        rgba(142, 42, 115, .18)
                    );
                border:
                    1px solid rgba(255, 210, 80, .28);
            }

            .cc-customer h3 {
                margin: 0;
                font-size: 16px;
                color: #fff;
                font-weight: 800;
            }

            .cc-customer p {
                margin: 4px 0 0;
                color: rgba(255,255,255,.68);
                font-size: 13px;
            }

            .cc-customer small {
                display: block;
                margin-top: 3px;
                color: rgba(255,255,255,.45);
                font-size: 11px;
                word-break: break-word;
            }

            .cc-status-badge {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 7px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
                border:
                    1px solid rgba(255,255,255,.1);
            }

            .cc-status-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: currentColor;
                box-shadow:
                    0 0 9px currentColor;
            }

            .cc-status-badge.pending {
                color: #ffd86b;
                background:
                    rgba(255,193,7,.09);
            }

            .cc-status-badge.approved {
                color: #7df2ae;
                background:
                    rgba(65,210,125,.09);
            }

            .cc-status-badge.rejected {
                color: #ff7f9d;
                background:
                    rgba(255,65,105,.09);
            }

            .cc-status-badge.cancelled {
                color: #bdb7c8;
                background:
                    rgba(255,255,255,.06);
            }

            .cc-status-badge.processing {
                color: #bd9cff;
                background:
                    rgba(148,93,255,.09);
            }

            .cc-withdrawal-details {
                position: relative;
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap: 9px;
            }

            .cc-detail-box {
                padding: 11px;
                border-radius: 12px;
                background:
                    rgba(255,255,255,.035);
                border:
                    1px solid rgba(255,255,255,.065);
                min-width: 0;
            }

            .cc-detail-label {
                display: block;
                margin-bottom: 5px;
                color: rgba(255,255,255,.45);
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: .07em;
                font-weight: 700;
            }

            .cc-detail-box strong {
                display: block;
                color: #f8edf9;
                font-size: 13px;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }

            .cc-reference {
                margin-top: 12px;
                padding: 9px 11px;
                border-radius: 10px;
                background:
                    rgba(255,210,80,.045);
                border:
                    1px solid rgba(255,210,80,.09);
                color:
                    rgba(255,255,255,.55);
                font-size: 11px;
            }

            .cc-reference strong {
                color: #ffe18b;
                margin-left: 4px;
            }

            .cc-rejection-reason {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-top: 12px;
                padding: 10px 12px;
                border-radius: 10px;
                color: #ffb8c7;
                background:
                    rgba(255,55,100,.055);
                border:
                    1px solid rgba(255,55,100,.12);
                font-size: 12px;
            }

            .cc-rejection-reason span {
                color:
                    rgba(255,255,255,.68);
            }

            .cc-withdrawal-footer {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-top: 16px;
                padding-top: 14px;
                border-top:
                    1px solid rgba(255,255,255,.07);
            }

            .cc-account-info {
                display: flex;
                flex-direction: column;
                gap: 3px;
                min-width: 0;
            }

            .cc-account-info span {
                color:
                    rgba(255,255,255,.4);
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: .06em;
            }

            .cc-account-info strong {
                color:
                    rgba(255,255,255,.78);
                font-size: 12px;
                overflow-wrap: anywhere;
            }

            .cc-withdrawal-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }

            .cc-withdraw-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                min-height: 39px;
                padding: 9px 13px;
                border-radius: 11px;
                border: 1px solid transparent;
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                font-weight: 800;
                transition:
                    transform .18s ease,
                    box-shadow .18s ease,
                    background .18s ease;
            }

            .cc-withdraw-action:hover {
                transform: translateY(-1px);
            }

            .cc-withdraw-action:active {
                transform: translateY(0);
            }

            .cc-approve-btn {
                color: #fff4c6;
                background:
                    linear-gradient(
                        135deg,
                        rgba(126, 88, 10, .95),
                        rgba(169, 67, 104, .9)
                    );
                border-color:
                    rgba(255,210,80,.28);
            }

            .cc-reject-btn {
                color: #ffd9e2;
                background:
                    rgba(125, 24, 62, .4);
                border-color:
                    rgba(255,92,130,.22);
            }

            .cc-btn-icon {
                display: grid;
                place-items: center;
            }

            .cc-withdraw-action.is-loading {
                pointer-events: none;
                opacity: .65;
            }

            .cc-action-state {
                display: flex;
                align-items: center;
            }

            .cc-empty-withdrawals {
                width: 100%;
                padding: 45px 20px;
                text-align: center;
                border-radius: 16px;
                border:
                    1px dashed rgba(255,255,255,.12);
                background:
                    rgba(255,255,255,.025);
            }

            .cc-empty-icon {
                width: 58px;
                height: 58px;
                margin: 0 auto 13px;
                display: grid;
                place-items: center;
                border-radius: 50%;
                color: #ffd86b;
                background:
                    rgba(255,210,80,.07);
                border:
                    1px solid rgba(255,210,80,.16);
                font-size: 25px;
                font-weight: 900;
            }

            .cc-empty-withdrawals h3 {
                margin: 0 0 6px;
                color:
                    rgba(255,255,255,.82);
                font-size: 16px;
            }

            .cc-empty-withdrawals p {
                margin: 0;
                color:
                    rgba(255,255,255,.55);
                font-size: 13px;
                word-break: break-word;
            }

            .cc-loading-spinner {
                width: 36px;
                height: 36px;
                margin: 0 auto 15px;
                border-radius: 50%;
                border:
                    3px solid rgba(255,255,255,.12);
                border-top-color: #ffd86b;
                animation:
                    cc-withdraw-spin .8s linear infinite;
            }

            .cc-retry-btn {
                margin-top: 18px;
                padding: 10px 18px;
                border: 1px solid
                    rgba(255,210,80,.25);
                border-radius: 10px;
                background:
                    rgba(255,210,80,.08);
                color: #ffe89a;
                cursor: pointer;
                font-weight: 800;
            }

            @keyframes cc-withdraw-spin {
                to {
                    transform: rotate(360deg);
                }
            }

            @media (max-width: 700px) {

                .cc-withdrawals-grid {
                    grid-template-columns: 1fr;
                }

                .cc-withdrawal-top {
                    flex-direction: column;
                }

                .cc-status-area {
                    align-self: flex-start;
                }

                .cc-withdrawal-footer {
                    flex-direction: column;
                    align-items: stretch;
                }

                .cc-withdrawal-actions {
                    width: 100%;
                }

                .cc-withdraw-action {
                    flex: 1;
                }
            }

            @media (max-width: 420px) {

                .cc-withdrawal-card {
                    padding: 14px;
                }

                .cc-withdrawal-details {
                    grid-template-columns: 1fr;
                }

                .cc-withdrawal-actions {
                    flex-direction: column;
                }

                .cc-withdraw-action {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------
       Filters
       ------------------------------------------------------------ */

    function getFilterValues() {
        const status =
            $(
                "#statusFilter, " +
                "#withdrawalStatusFilter, " +
                "[name='status']"
            )?.value || "";

        const method =
            $(
                "#methodFilter, " +
                "#withdrawalMethodFilter, " +
                "[name='method']"
            )?.value || "";

        const payout =
            $(
                "#payoutStatusFilter, " +
                "#withdrawalPayoutFilter, " +
                "[name='payout_status']"
            )?.value || "";

        return {
            status,
            method,
            payout
        };
    }

    function applyLocalFilters(list) {
        const filters =
            getFilterValues();

        return list.filter(
            (item) => {

                const statusMatch =
                    !filters.status ||
                    filters.status === "all" ||
                    String(item.status)
                        .toLowerCase() ===
                    String(filters.status)
                        .toLowerCase();

                const methodValue =
                    String(
                        item.method || ""
                    ).toLowerCase();

                const methodFilter =
                    String(
                        filters.method || ""
                    ).toLowerCase();

                const methodMatch =
                    !methodFilter ||
                    methodFilter === "all" ||
                    methodValue ===
                        methodFilter;

                const payoutMatch =
                    !filters.payout ||
                    filters.payout === "all" ||
                    String(
                        item.payoutStatus
                    ).toLowerCase() ===
                    String(
                        filters.payout
                    ).toLowerCase();

                return (
                    statusMatch &&
                    methodMatch &&
                    payoutMatch
                );
            }
        );
    }

    function bindFilters() {
        const selectors = [
            "#statusFilter",
            "#withdrawalStatusFilter",
            "#methodFilter",
            "#withdrawalMethodFilter",
            "#payoutStatusFilter",
            "#withdrawalPayoutFilter"
        ];

        selectors.forEach(
            (selector) => {

                $$(selector).forEach(
                    (element) => {

                        element.addEventListener(
                            "change",
                            () => {

                                const filters =
                                    getFilterValues();

                                currentStatus =
                                    filters.status;

                                currentMethod =
                                    filters.method;

                                currentPayoutStatus =
                                    filters.payout;

                                loadWithdrawals();
                            }
                        );

                    }
                );

            }
        );
    }

    /* ------------------------------------------------------------
       Load withdrawals
       ------------------------------------------------------------ */

    async function loadWithdrawals() {

        if (isLoading) {
            return;
        }

        isLoading = true;

        try {
            const filters =
                getFilterValues();

            const params =
                new URLSearchParams();

            if (filters.status) {
                params.set(
                    "status",
                    filters.status
                );
            }

            if (filters.method) {
                params.set(
                    "method",
                    filters.method
                );
            }

            if (filters.payout) {
                params.set(
                    "payout_status",
                    filters.payout
                );
            }

            const url =
                params.toString()
                    ? `${API_URL}?${params.toString()}`
                    : API_URL;

            console.log(
                "Crown Cash: loading withdrawals from:",
                url
            );

            renderLoading();

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        credentials:
                            "include",

                        cache:
                            "no-store",

                        headers: {
                            "Accept":
                                "application/json",

                            "Cache-Control":
                                "no-cache"
                        }
                    }
                );

            const rawText =
                await response.text();

            console.log(
                "Crown Cash withdrawal HTTP status:",
                response.status
            );

            console.log(
                "Crown Cash withdrawal raw response:",
                rawText
            );

            let data = {};

            if (
                rawText &&
                rawText.trim() !== ""
            ) {
                try {
                    data =
                        JSON.parse(
                            rawText
                        );
                } catch (parseError) {

                    throw new Error(
                        `Server returned invalid JSON ` +
                        `(HTTP ${response.status}). ` +
                        rawText.substring(
                            0,
                            500
                        )
                    );
                }
            }

            if (!response.ok) {
                throw new Error(
                    extractServerError(
                        data,
                        rawText,
                        response.status
                    )
                );
            }

            if (
                data &&
                (
                    data.success === false ||
                    data.ok === false
                )
            ) {
                throw new Error(
                    extractServerError(
                        data,
                        rawText,
                        response.status
                    )
                );
            }

            console.log(
                "Crown Cash withdrawal response:",
                data
            );

            const rawList =
                data.withdrawals ||
                data.requests ||
                data.data ||
                [];

            if (
                !Array.isArray(rawList)
            ) {
                console.warn(
                    "Withdrawal response does not contain an array:",
                    data
                );

                withdrawals = [];

            } else {

                withdrawals =
                    rawList.map(
                        normalizeWithdrawal
                    );
            }

            updateStats(data);

            const filtered =
                applyLocalFilters(
                    withdrawals
                );

            renderWithdrawals(
                filtered
            );

        } catch (error) {

            console.error(
                "Crown Cash withdrawal loading error:",
                error
            );

            renderError(error);

            showToast(
                error.message ||
                "Unable to load withdrawal requests.",
                "error"
            );

        } finally {

            isLoading = false;
        }
    }

    /* ------------------------------------------------------------
       Find withdrawal
       ------------------------------------------------------------ */

    function findWithdrawal(id) {
        return withdrawals.find(
            (item) =>
                String(item.id) ===
                String(id)
        );
    }

    /* ------------------------------------------------------------
       Approve withdrawal
       ------------------------------------------------------------ */

    async function approveWithdrawal(
        id,
        button
    ) {

        const withdrawal =
            findWithdrawal(id);

        if (!withdrawal) {
            showToast(
                "Withdrawal request could not be found.",
                "error"
            );

            return;
        }

        if (
            withdrawal.status !== "pending" &&
            withdrawal.status !==
                "awaiting_approval" &&
            withdrawal.status !== "processing"
        ) {
            showToast(
                "This withdrawal has already been processed.",
                "error"
            );

            return;
        }

        const confirmed =
            window.confirm(
                `Approve this withdrawal request?\n\n` +
                `Customer: ${withdrawal.name}\n` +
                `Phone: ${withdrawal.phone}\n` +
                `Requested: ${money(
                    withdrawal.amount
                )}\n` +
                `Fee: ${money(
                    withdrawal.fee
                )}\n` +
                `Payout: ${money(
                    withdrawal.net
                )}\n\n` +
                `The request will be marked as approved.`
            );

        if (!confirmed) {
            return;
        }

        setButtonLoading(
            button,
            true
        );

        try {

            const data =
                await apiRequest({
                    method: "POST",

                    body: {
                        action: "approve",

                        withdrawal_id: id,

                        withdrawalId: id,

                        id: id
                    }
                });

            showToast(
                data.message ||
                "Withdrawal approved successfully."
            );

            await loadWithdrawals();

        } catch (error) {

            console.error(
                "Withdrawal approval error:",
                error
            );

            showToast(
                error.message ||
                "Unable to approve withdrawal.",
                "error"
            );

        } finally {

            setButtonLoading(
                button,
                false
            );
        }
    }

    /* ------------------------------------------------------------
       Reject withdrawal
       ------------------------------------------------------------ */

    async function rejectWithdrawal(
        id,
        button
    ) {

        const withdrawal =
            findWithdrawal(id);

        if (!withdrawal) {
            showToast(
                "Withdrawal request could not be found.",
                "error"
            );

            return;
        }

        if (
            withdrawal.status !== "pending" &&
            withdrawal.status !==
                "awaiting_approval" &&
            withdrawal.status !== "processing"
        ) {
            showToast(
                "This withdrawal has already been processed.",
                "error"
            );

            return;
        }

        const reason =
            window.prompt(
                "Enter the reason for rejecting this withdrawal request:"
            );

        if (reason === null) {
            return;
        }

        const trimmedReason =
            reason.trim();

        if (!trimmedReason) {
            showToast(
                "A rejection reason is required.",
                "error"
            );

            return;
        }

        const confirmed =
            window.confirm(
                `Reject this withdrawal request?\n\n` +
                `Customer: ${withdrawal.name}\n` +
                `Requested: ${money(
                    withdrawal.amount
                )}\n\n` +
                `Reason:\n${trimmedReason}`
            );

        if (!confirmed) {
            return;
        }

        setButtonLoading(
            button,
            true
        );

        try {

            const data =
                await apiRequest({
                    method: "POST",

                    body: {
                        action: "reject",

                        withdrawal_id: id,

                        withdrawalId: id,

                        id: id,

                        reason:
                            trimmedReason,

                        rejection_reason:
                            trimmedReason
                    }
                });

            showToast(
                data.message ||
                "Withdrawal rejected successfully."
            );

            await loadWithdrawals();

        } catch (error) {

            console.error(
                "Withdrawal rejection error:",
                error
            );

            showToast(
                error.message ||
                "Unable to reject withdrawal.",
                "error"
            );

        } finally {

            setButtonLoading(
                button,
                false
            );
        }
    }

    /* ------------------------------------------------------------
       Button loading state
       ------------------------------------------------------------ */

    function setButtonLoading(
        button,
        loading
    ) {

        if (!button) {
            return;
        }

        if (loading) {

            button.classList.add(
                "is-loading"
            );

            button.disabled = true;

            if (
                !button.dataset.originalHTML
            ) {
                button.dataset.originalHTML =
                    button.innerHTML;
            }

            const text =
                button.textContent
                    .trim()
                    .toLowerCase();

            const label =
                text.includes("reject")
                    ? "Rejecting..."
                    : "Approving...";

            button.innerHTML = `
                <span class="cc-btn-icon">
                    ...
                </span>

                <span>
                    ${label}
                </span>
            `;

        } else {

            button.classList.remove(
                "is-loading"
            );

            button.disabled = false;

            if (
                button.dataset.originalHTML
            ) {
                button.innerHTML =
                    button.dataset.originalHTML;

                delete button.dataset.originalHTML;
            }
        }
    }

    /* ------------------------------------------------------------
       Event delegation
       ------------------------------------------------------------ */

    function bindActionButtons() {

        document.addEventListener(
            "click",
            async (event) => {

                const approveButton =
                    event.target.closest(
                        ".cc-approve-btn"
                    );

                if (approveButton) {

                    event.preventDefault();

                    const id =
                        approveButton
                            .dataset
                            .withdrawalId;

                    await approveWithdrawal(
                        id,
                        approveButton
                    );

                    return;
                }

                const rejectButton =
                    event.target.closest(
                        ".cc-reject-btn"
                    );

                if (rejectButton) {

                    event.preventDefault();

                    const id =
                        rejectButton
                            .dataset
                            .withdrawalId;

                    await rejectWithdrawal(
                        id,
                        rejectButton
                    );
                }
            }
        );
    }

    /* ------------------------------------------------------------
       Refresh buttons
       ------------------------------------------------------------ */

    function bindRefreshButtons() {

        const selectors = [
            "#refreshWithdrawals",
            "#refresh-withdrawals",
            "[data-refresh-withdrawals]"
        ];

        selectors.forEach(
            (selector) => {

                $$(selector).forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            async (event) => {

                                event.preventDefault();

                                button.disabled =
                                    true;

                                try {

                                    await loadWithdrawals();

                                } finally {

                                    button.disabled =
                                        false;
                                }
                            }
                        );

                    }
                );

            }
        );
    }

    /* ------------------------------------------------------------
       Initialize
       ------------------------------------------------------------ */

    async function init() {

        console.log(
            "Crown Cash Admin Withdrawals initializing..."
        );

        injectStyles();

        bindFilters();

        bindActionButtons();

        bindRefreshButtons();

        await loadWithdrawals();

        if (refreshTimer) {
            clearInterval(
                refreshTimer
            );
        }

        refreshTimer =
            setInterval(
                () => {

                    if (
                        !document.hidden
                    ) {
                        loadWithdrawals();
                    }

                },
                30000
            );
    }

    /* ------------------------------------------------------------
       Start
       ------------------------------------------------------------ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();
    }

    /* ------------------------------------------------------------
       Global API
       ------------------------------------------------------------ */

    window.CrownCashWithdrawals = {

        load:
            loadWithdrawals,

        approve:
            approveWithdrawal,

        reject:
            rejectWithdrawal,

        getWithdrawals:
            () => withdrawals.slice(),

        getApiUrl:
            () => API_URL
    };

})();