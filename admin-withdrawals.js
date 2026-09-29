/* ============================================================
   CROWN CASH — ADMIN WITHDRAWALS
   Complete frontend controller
   ============================================================ */

(() => {
    "use strict";

    /* ------------------------------------------------------------
       API
    ------------------------------------------------------------ */

    const API_URL =
        "https://crown-cash1.onrender.com/admin-withdrawals.php";

    /* ------------------------------------------------------------
       State
    ------------------------------------------------------------ */

    let withdrawals = [];
    let currentStatus = "";
    let currentMethod = "";
    let currentPayoutStatus = "";

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
        let toast = document.getElementById("cc-admin-toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "cc-admin-toast";

            toast.style.position = "fixed";
            toast.style.right = "20px";
            toast.style.bottom = "20px";
            toast.style.zIndex = "99999";
            toast.style.maxWidth = "360px";
            toast.style.padding = "14px 18px";
            toast.style.borderRadius = "14px";
            toast.style.fontSize = "14px";
            toast.style.fontWeight = "700";
            toast.style.lineHeight = "1.45";
            toast.style.backdropFilter = "blur(18px)";
            toast.style.webkitBackdropFilter = "blur(18px)";
            toast.style.boxShadow =
                "0 12px 35px rgba(0,0,0,.35)";

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
        }, 3500);
    }

    /* ------------------------------------------------------------
       Authentication / fetch
    ------------------------------------------------------------ */

    async function apiRequest(options = {}) {
        const method = options.method || "GET";
        const body = options.body || null;

        const fetchOptions = {
            method,
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        };

        if (body) {
            fetchOptions.headers["Content-Type"] =
                "application/json";

            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(API_URL, fetchOptions);

        const rawText = await response.text();

        let data = {};

        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (error) {
            throw new Error(
                rawText ||
                `Server returned HTTP ${response.status}`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed with HTTP ${response.status}`
            );
        }

        if (
            data.success === false &&
            data.ok === false
        ) {
            throw new Error(
                data.message ||
                data.error ||
                "The request was not successful."
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

        /*
         * Fallback:
         * Find an element containing the existing empty-state
         * or withdrawal request heading.
         */
        const candidates = $$(
            "main section, main div, section, .card, .panel"
        );

        for (const element of candidates) {
            const text = element.textContent || "";

            if (
                text.includes("No withdrawal requests") ||
                text.includes("Withdrawal Requests")
            ) {
                return element;
            }
        }

        return null;
    }

    /* ------------------------------------------------------------
       Normalize withdrawal
    ------------------------------------------------------------ */

    function normalizeWithdrawal(item) {
        return {
            id: getValue(
                item,
                "_id",
                "id",
                "withdrawal_id",
                "withdrawalId"
            ),

            reference: getValue(
                item,
                "reference",
                "withdrawal_reference",
                "withdrawalReference"
            ),

            userId: getValue(
                item,
                "user_id",
                "userId",
                "member_id",
                "memberId"
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

        try {
            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return String(value);
            }

            return date.toLocaleString("en-UG", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch (error) {
            return String(value);
        }
    }

    /* ------------------------------------------------------------
       Method label
    ------------------------------------------------------------ */

    function methodLabel(method) {
        const value = String(method || "")
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

        return "Method unknown";
    }

    /* ------------------------------------------------------------
       Payout label
    ------------------------------------------------------------ */

    function payoutLabel(status) {
        const value = String(status || "")
            .toLowerCase()
            .trim();

        switch (value) {
            case "awaiting_payout":
                return "Awaiting Payout";

            case "paid":
                return "Paid";

            case "payout_failed":
                return "Payout Failed";

            case "not_required":
            default:
                return "Not Required";
        }
    }

    /* ------------------------------------------------------------
       Status badge
    ------------------------------------------------------------ */

    function statusBadge(status) {
        const value = String(status || "pending")
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
        const status = String(
            withdrawal.status || ""
        ).toLowerCase();

        /*
         * Only pending/open requests can be approved or rejected.
         */
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
                            <path d="M20 6 9 17l-5-5"></path>
                        </svg>
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
                            <path d="M18 6 6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
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
        const safeId = escapeHTML(withdrawal.id);

        return `
            <article
                class="cc-withdrawal-card"
                data-withdrawal-card="${safeId}"
                data-withdrawal-id="${safeId}"
            >

                <div class="cc-withdrawal-top">

                    <div class="cc-customer">

                        <div class="cc-customer-icon">
                            <svg
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="12"
                                    cy="8"
                                    r="3"
                                ></circle>

                                <path
                                    d="M5 20c.7-3.3 3.1-5 7-5s6.3 1.7 7 5"
                                ></path>
                            </svg>
                        </div>

                        <div>
                            <h3>
                                ${escapeHTML(withdrawal.name)}
                            </h3>

                            <p>
                                ${escapeHTML(withdrawal.phone)}
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
                        ${statusBadge(withdrawal.status)}
                    </div>

                </div>


                <div class="cc-withdrawal-details">

                    <div class="cc-detail-box">

                        <span class="cc-detail-label">
                            Requested
                        </span>

                        <strong>
                            ${money(withdrawal.amount)}
                        </strong>

                    </div>


                    <div class="cc-detail-box">

                        <span class="cc-detail-label">
                            Fee
                        </span>

                        <strong>
                            ${money(withdrawal.fee)}
                        </strong>

                    </div>


                    <div class="cc-detail-box">

                        <span class="cc-detail-label">
                            Payout
                        </span>

                        <strong>
                            ${money(withdrawal.net)}
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

                    ${actionButtons(withdrawal)}

                </div>

            </article>
        `;
    }

    /* ------------------------------------------------------------
       Render withdrawals
    ------------------------------------------------------------ */

    function renderWithdrawals(list) {
        const container = findWithdrawalContainer();

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

                        <svg
                            viewBox="0 0 24 24"
                            width="30"
                            height="30"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path
                                d="M12 3v12"
                            ></path>

                            <path
                                d="m7 10 5 5 5-5"
                            ></path>

                            <path
                                d="M5 21h14"
                            ></path>
                        </svg>

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
                ${list.map(withdrawalCard).join("")}
            </div>
        `;
    }

    /* ------------------------------------------------------------
       Stats
    ------------------------------------------------------------ */

    function updateStats(data) {
        const stats =
            data?.stats ||
            data?.statistics ||
            {};

        /*
         * Backend stats may use several naming conventions.
         */
        const total = Number(
            getValue(
                stats,
                "total",
                "total_withdrawals",
                "totalWithdrawals",
                "total_amount"
            ) || 0
        );

        const pending = Number(
            getValue(
                stats,
                "pending",
                "pending_requests",
                "pendingRequests",
                "pending_amount"
            ) || 0
        );

        const approved = Number(
            getValue(
                stats,
                "approved",
                "approved_withdrawals",
                "approvedWithdrawals",
                "approved_amount"
            ) || 0
        );

        const rejected = Number(
            getValue(
                stats,
                "rejected",
                "rejected_withdrawals",
                "rejectedWithdrawals",
                "rejected_amount"
            ) || 0
        );

        /*
         * First try data attributes.
         */
        const statElements = $$(
            "[data-withdrawal-stat]"
        );

        statElements.forEach((element) => {
            const type =
                element
                    .getAttribute("data-withdrawal-stat")
                    ?.toLowerCase();

            if (type === "total") {
                element.textContent = money(total);
            }

            if (type === "pending") {
                element.textContent = money(pending);
            }

            if (type === "approved") {
                element.textContent = money(approved);
            }

            if (type === "rejected") {
                element.textContent = money(rejected);
            }
        });

        /*
         * Also support common IDs.
         */
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

        Object.entries(possible).forEach(
            ([type, selectors]) => {
                for (const selector of selectors) {
                    const element = $(selector);

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

                    element.textContent = money(value);
                    break;
                }
            }
        );
    }

    /* ------------------------------------------------------------
       Add CSS automatically
    ------------------------------------------------------------ */

    function injectStyles() {
        if (
            document.getElementById(
                "cc-admin-withdrawal-styles"
            )
        ) {
            return;
        }

        const style = document.createElement("style");

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

            .cc-withdrawal-card::before {
                content: "";
                position: absolute;
                inset: 0;
                pointer-events: none;
                background:
                    radial-gradient(
                        circle at top right,
                        rgba(255, 193, 73, .08),
                        transparent 35%
                    );
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
                box-shadow:
                    0 0 18px rgba(255, 79, 155, .12);
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
                border: 1px solid rgba(255,255,255,.1);
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
                background: rgba(255,193,7,.09);
                border-color: rgba(255,193,7,.2);
            }

            .cc-status-badge.approved {
                color: #7df2ae;
                background: rgba(65,210,125,.09);
                border-color: rgba(65,210,125,.2);
            }

            .cc-status-badge.rejected {
                color: #ff7f9d;
                background: rgba(255,65,105,.09);
                border-color: rgba(255,65,105,.2);
            }

            .cc-status-badge.cancelled {
                color: #bdb7c8;
                background: rgba(255,255,255,.06);
            }

            .cc-status-badge.processing {
                color: #bd9cff;
                background: rgba(148,93,255,.09);
                border-color: rgba(148,93,255,.2);
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
                background: rgba(255,255,255,.035);
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
                background: rgba(255,210,80,.045);
                border:
                    1px solid rgba(255,210,80,.09);
                color: rgba(255,255,255,.55);
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
                background: rgba(255,55,100,.055);
                border:
                    1px solid rgba(255,55,100,.12);
                font-size: 12px;
            }

            .cc-rejection-reason span {
                color: rgba(255,255,255,.68);
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
                color: rgba(255,255,255,.4);
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: .06em;
            }

            .cc-account-info strong {
                color: rgba(255,255,255,.78);
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
                box-shadow:
                    0 7px 20px rgba(255,170,60,.11);
            }

            .cc-approve-btn:hover {
                box-shadow:
                    0 9px 25px rgba(255,170,60,.2);
            }

            .cc-reject-btn {
                color: #ffd9e2;
                background:
                    rgba(125, 24, 62, .4);
                border-color:
                    rgba(255,92,130,.22);
            }

            .cc-reject-btn:hover {
                background:
                    rgba(160, 30, 72, .55);
                box-shadow:
                    0 9px 25px rgba(255,50,100,.1);
            }

            .cc-btn-icon {
                display: grid;
                place-items: center;
            }

            .cc-withdraw-action.is-loading {
                pointer-events: none;
                opacity: .65;
            }

            .cc-withdraw-action.is-loading
            .cc-btn-icon {
                animation:
                    cc-spin .8s linear infinite;
            }

            @keyframes cc-spin {
                to {
                    transform: rotate(360deg);
                }
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
            }

            .cc-empty-withdrawals h3 {
                margin: 0 0 6px;
                color: rgba(255,255,255,.82);
                font-size: 16px;
            }

            .cc-empty-withdrawals p {
                margin: 0;
                color: rgba(255,255,255,.45);
                font-size: 13px;
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
        const filters = getFilterValues();

        return list.filter((item) => {
            const statusMatch =
                !filters.status ||
                filters.status === "all" ||
                String(item.status).toLowerCase() ===
                    String(filters.status).toLowerCase();

            const methodValue =
                String(item.method || "")
                    .toLowerCase();

            const methodFilter =
                String(filters.method || "")
                    .toLowerCase();

            const methodMatch =
                !methodFilter ||
                methodFilter === "all" ||
                methodValue === methodFilter;

            const payoutMatch =
                !filters.payout ||
                filters.payout === "all" ||
                String(item.payoutStatus).toLowerCase() ===
                    String(filters.payout).toLowerCase();

            return (
                statusMatch &&
                methodMatch &&
                payoutMatch
            );
        });
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

        selectors.forEach((selector) => {
            $$(selector).forEach((element) => {
                element.addEventListener(
                    "change",
                    () => {
                        currentStatus =
                            getFilterValues().status;

                        currentMethod =
                            getFilterValues().method;

                        currentPayoutStatus =
                            getFilterValues().payout;

                        loadWithdrawals();
                    }
                );
            });
        });
    }

    /* ------------------------------------------------------------
       Load withdrawals
    ------------------------------------------------------------ */

    async function loadWithdrawals() {
        try {
            const filters = getFilterValues();

            const params = new URLSearchParams();

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

            const response = await fetch(url, {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            });

            const rawText =
                await response.text();

            let data = {};

            try {
                data = rawText
                    ? JSON.parse(rawText)
                    : {};
            } catch (error) {
                throw new Error(
                    rawText ||
                    `Invalid server response (${response.status})`
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    `Unable to load withdrawals (${response.status})`
                );
            }

            const rawList =
                data.withdrawals ||
                data.requests ||
                data.data ||
                [];

            withdrawals = Array.isArray(rawList)
                ? rawList.map(normalizeWithdrawal)
                : [];

            updateStats(data);

            /*
             * Render using backend-filtered records.
             * Local filtering is also applied as a safety net.
             */
            renderWithdrawals(
                applyLocalFilters(withdrawals)
            );

        } catch (error) {
            console.error(
                "Crown Cash withdrawal loading error:",
                error
            );

            const container =
                findWithdrawalContainer();

            if (container) {
                container.innerHTML = `
                    <div class="cc-empty-withdrawals">

                        <div class="cc-empty-icon">
                            <svg
                                viewBox="0 0 24 24"
                                width="30"
                                height="30"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                ></circle>

                                <path
                                    d="M12 8v5"
                                ></path>

                                <path
                                    d="M12 16h.01"
                                ></path>
                            </svg>
                        </div>

                        <h3>
                            Unable to load withdrawal requests
                        </h3>

                        <p>
                            ${escapeHTML(
                                error.message ||
                                "Please refresh and try again."
                            )}
                        </p>

                    </div>
                `;
            }
        }
    }

    /* ------------------------------------------------------------
       Find withdrawal
    ------------------------------------------------------------ */

    function findWithdrawal(id) {
        return withdrawals.find(
            (item) =>
                String(item.id) === String(id)
        );
    }

    /* ------------------------------------------------------------
       Approve withdrawal
    ------------------------------------------------------------ */

    async function approveWithdrawal(id, button) {
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
            withdrawal.status !== "awaiting_approval" &&
            withdrawal.status !== "processing"
        ) {
            showToast(
                "This withdrawal has already been processed.",
                "error"
            );
            return;
        }

        const confirmed = window.confirm(
            `Approve this withdrawal request?\n\n` +
            `Customer: ${withdrawal.name}\n` +
            `Phone: ${withdrawal.phone}\n` +
            `Requested: ${money(withdrawal.amount)}\n` +
            `Fee: ${money(withdrawal.fee)}\n` +
            `Payout: ${money(withdrawal.net)}\n\n` +
            `Approval will mark the request as approved and ` +
            `awaiting payout. It will NOT mark the money as paid.`
        );

        if (!confirmed) {
            return;
        }

        setButtonLoading(button, true);

        try {
            const data = await apiRequest({
                method: "POST",
                body: {
                    action: "approve",
                    withdrawal_id: id,
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
                "Approval error:",
                error
            );

            showToast(
                error.message ||
                "Unable to approve withdrawal.",
                "error"
            );

        } finally {
            setButtonLoading(button, false);
        }
    }

    /* ------------------------------------------------------------
       Reject withdrawal
    ------------------------------------------------------------ */

    async function rejectWithdrawal(id, button) {
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
            withdrawal.status !== "awaiting_approval" &&
            withdrawal.status !== "processing"
        ) {
            showToast(
                "This withdrawal has already been processed.",
                "error"
            );
            return;
        }

        const reason = window.prompt(
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

        const confirmed = window.confirm(
            `Reject this withdrawal request?\n\n` +
            `Customer: ${withdrawal.name}\n` +
            `Requested: ${money(withdrawal.amount)}\n\n` +
            `Reason:\n${trimmedReason}`
        );

        if (!confirmed) {
            return;
        }

        setButtonLoading(button, true);

        try {
            const data = await apiRequest({
                method: "POST",
                body: {
                    action: "reject",
                    withdrawal_id: id,
                    id: id,
                    reason: trimmedReason,
                    rejection_reason: trimmedReason
                }
            });

            showToast(
                data.message ||
                "Withdrawal rejected successfully."
            );

            await loadWithdrawals();

        } catch (error) {
            console.error(
                "Rejection error:",
                error
            );

            showToast(
                error.message ||
                "Unable to reject withdrawal.",
                "error"
            );

        } finally {
            setButtonLoading(button, false);
        }
    }

    /* ------------------------------------------------------------
       Button loading state
    ------------------------------------------------------------ */

    function setButtonLoading(button, loading) {
        if (!button) {
            return;
        }

        if (loading) {
            button.classList.add(
                "is-loading"
            );

            button.disabled = true;

            const original =
                button.innerHTML;

            button.dataset.originalHTML =
                original;

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
                    <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        ></circle>

                        <path
                            d="M12 7v5"
                        ></path>

                        <path
                            d="M12 16h.01"
                        ></path>
                    </svg>
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
                        approveButton.dataset
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
                        rejectButton.dataset
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
       Refresh button support
    ------------------------------------------------------------ */

    function bindRefreshButtons() {
        const selectors = [
            "#refreshWithdrawals",
            "#refresh-withdrawals",
            "[data-refresh-withdrawals]"
        ];

        selectors.forEach((selector) => {
            $$(selector).forEach((button) => {
                button.addEventListener(
                    "click",
                    async (event) => {
                        event.preventDefault();

                        button.disabled = true;

                        try {
                            await loadWithdrawals();
                        } finally {
                            button.disabled = false;
                        }
                    }
                );
            });
        });
    }

    /* ------------------------------------------------------------
       Initialization
    ------------------------------------------------------------ */

    async function init() {
        injectStyles();

        bindFilters();

        bindActionButtons();

        bindRefreshButtons();

        await loadWithdrawals();

        /*
         * Keep the page reasonably fresh while open.
         * This does not approve/reject anything automatically.
         */
        setInterval(
            () => {
                loadWithdrawals();
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
            init
        );
    } else {
        init();
    }

    /* ------------------------------------------------------------
       Optional global functions
       Useful if existing HTML calls them directly.
    ------------------------------------------------------------ */

    window.CrownCashWithdrawals = {
        load: loadWithdrawals,
        approve: approveWithdrawal,
        reject: rejectWithdrawal
    };

})();