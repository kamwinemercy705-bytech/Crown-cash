(() => {
    "use strict";

    const API_BASE = "https://crown-cash1.onrender.com";

    const ADMIN_AUTH_API =
        `${API_BASE}/admin-auth.php`;

    const WITHDRAWALS_API =
        `${API_BASE}/admin-withdrawals.php`;

    const PROFILE_API =
        `${API_BASE}/profile.php`;

    let withdrawals = [];
    let filteredWithdrawals = [];

    let currentStatus = "all";
    let currentMethod = "all";
    let currentPayoutStatus = "all";
    let currentSearch = "";

    const $ = (id) =>
        document.getElementById(id);

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatUGX(value) {
        const amount = Number(value || 0);

        return "UGX " + amount.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        );
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString(
            "en-UG",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function normalize(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase();
    }

    function getValue(item, keys, fallback = "") {
        for (const key of keys) {
            if (
                item &&
                item[key] !== undefined &&
                item[key] !== null &&
                item[key] !== ""
            ) {
                return item[key];
            }
        }

        return fallback;
    }

    function getWithdrawalId(item) {
        return String(
            getValue(
                item,
                [
                    "id",
                    "_id",
                    "withdrawal_id",
                    "withdrawalId"
                ],
                ""
            )
        );
    }

    function getUserName(item) {
        return getValue(
            item,
            [
                "full_name",
                "user_name",
                "name",
                "customer_name",
                "customerName"
            ],
            "Customer"
        );
    }

    function getEmail(item) {
        return getValue(
            item,
            [
                "email",
                "user_email",
                "customer_email"
            ],
            "—"
        );
    }

    function getPhone(item) {
        return getValue(
            item,
            [
                "phone",
                "phone_number",
                "mobile",
                "registered_phone"
            ],
            "—"
        );
    }

    function getAmount(item) {
        return Number(
            getValue(
                item,
                [
                    "amount",
                    "requested_amount",
                    "requestedAmount"
                ],
                0
            )
        );
    }

    function getFee(item) {
        return Number(
            getValue(
                item,
                [
                    "fee",
                    "withdrawal_fee"
                ],
                0
            )
        );
    }

    function getPayout(item) {
        return Number(
            getValue(
                item,
                [
                    "payout_amount",
                    "payoutAmount",
                    "net_amount"
                ],
                Math.max(
                    0,
                    getAmount(item) - getFee(item)
                )
            )
        );
    }

    function getMethod(item) {
        return getValue(
            item,
            [
                "payment_method",
                "method",
                "network"
            ],
            "—"
        );
    }

    function getStatus(item) {
        return normalize(
            getValue(
                item,
                [
                    "status",
                    "withdrawal_status"
                ],
                "pending"
            )
        );
    }

    function getPayoutStatus(item) {
        return normalize(
            getValue(
                item,
                [
                    "payout_status",
                    "payoutStatus"
                ],
                "not_required"
            )
        );
    }

    function getDate(item) {
        return getValue(
            item,
            [
                "created_at",
                "createdAt",
                "requested_at",
                "date"
            ],
            ""
        );
    }

    async function fetchJSON(
        url,
        options = {}
    ) {
        const response = await fetch(
            url,
            {
                ...options,
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept":
                        "application/json",
                    ...(options.headers || {})
                }
            }
        );

        const text =
            await response.text();

        let data = null;

        try {
            data = text
                ? JSON.parse(text)
                : {};
        } catch (error) {
            throw new Error(
                "Server returned an invalid response."
            );
        }

        if (!response.ok) {
            const error =
                data?.message ||
                `Request failed (${response.status}).`;

            const exception =
                new Error(error);

            exception.status =
                response.status;

            throw exception;
        }

        return data;
    }

    /*
     * IMPORTANT:
     * Administrator verification is now isolated.
     * It cannot leave the page permanently stuck.
     */
    async function verifyAdministrator() {
        try {
            const data =
                await fetchJSON(
                    ADMIN_AUTH_API
                );

            if (
                data &&
                data.success === true &&
                data.authorized === true
            ) {
                return true;
            }

            throw new Error(
                data?.message ||
                "Administrator access was not confirmed."
            );
        } catch (error) {
            console.error(
                "Admin verification error:",
                error
            );

            showPageMessage(
                error.message ||
                "Administrator verification failed.",
                "error"
            );

            return false;
        }
    }

    async function loadProfile() {
        try {
            const data =
                await fetchJSON(
                    PROFILE_API
                );

            if (
                data?.success &&
                data.user
            ) {
                const name =
                    data.user.full_name ||
                    `${data.user.first_name || ""} ${data.user.last_name || ""}`
                        .trim() ||
                    "Administrator";

                const adminName =
                    $("adminName");

                const adminEmail =
                    $("adminEmail");

                if (adminName) {
                    adminName.textContent =
                        name;
                }

                if (adminEmail) {
                    adminEmail.textContent =
                        data.user.email || "";
                }
            }
        } catch (error) {
            /*
             * Profile information must NEVER
             * stop withdrawals from loading.
             */
            console.warn(
                "Profile could not be loaded:",
                error
            );
        }
    }

    function showPageMessage(
        message,
        type = "info"
    ) {
        const box =
            $("withdrawalMessage");

        if (!box) {
            return;
        }

        box.textContent = message;
        box.className =
            `admin-message ${type}`;

        box.hidden = false;
    }

    function hidePageMessage() {
        const box =
            $("withdrawalMessage");

        if (box) {
            box.hidden = true;
        }
    }

    function setLoading(
        loading
    ) {
        const loader =
            $("withdrawalsLoading");

        const empty =
            $("withdrawalsEmpty");

        const table =
            $("withdrawalsTable");

        const mobile =
            $("withdrawalsMobileList");

        if (loader) {
            loader.hidden = !loading;
        }

        if (loading) {
            if (empty) {
                empty.hidden = true;
            }

            if (table) {
                table.hidden = true;
            }

            if (mobile) {
                mobile.hidden = true;
            }
        }
    }

    function updateStats(data) {
        const stats =
            data?.stats ||
            data?.summary ||
            {};

        const total =
            Number(
                stats.total_withdrawals ??
                stats.total ??
                0
            );

        const pending =
            Number(
                stats.pending_withdrawals ??
                stats.pending ??
                0
            );

        const approved =
            Number(
                stats.approved_withdrawals ??
                stats.approved ??
                0
            );

        const rejected =
            Number(
                stats.rejected_withdrawals ??
                stats.rejected ??
                0
            );

        if ($("totalWithdrawals")) {
            $("totalWithdrawals")
                .textContent =
                formatUGX(total);
        }

        if ($("pendingWithdrawals")) {
            $("pendingWithdrawals")
                .textContent =
                formatUGX(pending);
        }

        if ($("approvedWithdrawals")) {
            $("approvedWithdrawals")
                .textContent =
                formatUGX(approved);
        }

        if ($("rejectedWithdrawals")) {
            $("rejectedWithdrawals")
                .textContent =
                formatUGX(rejected);
        }
    }

    async function loadWithdrawals() {
        setLoading(true);
        hidePageMessage();

        try {
            const data =
                await fetchJSON(
                    WITHDRAWALS_API
                );

            if (
                !data ||
                data.success !== true
            ) {
                throw new Error(
                    data?.message ||
                    "Unable to load withdrawal requests."
                );
            }

            withdrawals =
                Array.isArray(data.withdrawals)
                    ? data.withdrawals
                    : Array.isArray(data.data)
                        ? data.data
                        : [];

            updateStats(data);

            applyFilters();

        } catch (error) {
            console.error(
                "Withdrawal loading error:",
                error
            );

            withdrawals = [];
            filteredWithdrawals = [];

            renderWithdrawals();

            showPageMessage(
                error.message ||
                "Unable to load withdrawal requests.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    }

    function applyFilters() {
        const search =
            normalize(currentSearch);

        filteredWithdrawals =
            withdrawals.filter(
                (item) => {
                    const status =
                        getStatus(item);

                    const method =
                        normalize(
                            getMethod(item)
                        );

                    const payoutStatus =
                        getPayoutStatus(item);

                    if (
                        currentStatus !== "all" &&
                        status !==
                            currentStatus
                    ) {
                        return false;
                    }

                    if (
                        currentMethod !== "all" &&
                        method !==
                            normalize(
                                currentMethod
                            )
                    ) {
                        return false;
                    }

                    if (
                        currentPayoutStatus !==
                            "all" &&
                        payoutStatus !==
                            currentPayoutStatus
                    ) {
                        return false;
                    }

                    if (!search) {
                        return true;
                    }

                    const haystack =
                        [
                            getUserName(item),
                            getEmail(item),
                            getPhone(item),
                            getWithdrawalId(item),
                            getMethod(item),
                            getStatus(item),
                            getPayoutStatus(item)
                        ]
                            .join(" ")
                            .toLowerCase();

                    return haystack.includes(
                        search
                    );
                }
            );

        renderWithdrawals();
    }

    function statusLabel(status) {
        const value =
            normalize(status);

        const labels = {
            pending: "Pending",
            approved: "Approved",
            rejected: "Rejected",
            cancelled: "Cancelled"
        };

        return labels[value] ||
            value ||
            "Unknown";
    }

    function payoutLabel(status) {
        const value =
            normalize(status);

        const labels = {
            not_required:
                "Not Required",
            awaiting_payout:
                "Awaiting Payout",
            paid:
                "Paid",
            payout_failed:
                "Payout Failed"
        };

        return labels[value] ||
            value.replace(/_/g, " ") ||
            "—";
    }

    function statusClass(status) {
        const value =
            normalize(status);

        if (
            value === "approved"
        ) {
            return "status-approved";
        }

        if (
            value === "rejected" ||
            value === "cancelled"
        ) {
            return "status-rejected";
        }

        return "status-pending";
    }

    function methodClass(method) {
        return normalize(method)
            .includes("airtel")
            ? "method-airtel"
            : "method-mtn";
    }

    function userIcon() {
        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <circle cx="12"
                        cy="8"
                        r="3.5"/>
                <path d="M5 20c.8-3.3
                         3.1-5
                         7-5s6.2 1.7
                         7 5"/>
            </svg>
        `;
    }

    function phoneIcon() {
        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M7 4h3l1.5 4-2 1.5
                         c1 2.2 2.8 4
                         5 5l1.5-2
                         4 1.5v3
                         c0 .8-.7 1.5-1.5 1.5
                         C11 18.5 5.5 13
                         5.5 5.5
                         C5.5 4.7 6.2 4 7 4Z"/>
            </svg>
        `;
    }

    function mailIcon() {
        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <rect x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"/>
                <path d="m4 7 8 6
                         8-6"/>
            </svg>
        `;
    }

    function clockIcon() {
        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <circle cx="12"
                        cy="12"
                        r="8"/>
                <path d="M12 8v5l3 2"/>
            </svg>
        `;
    }

    function checkIcon() {
        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <circle cx="12"
                        cy="12"
                        r="8"/>
                <path d="m8.5 12
                         2.3 2.3
                         4.7-5"/>
            </svg>
        `;
    }

    function rejectIcon() {
        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <circle cx="12"
                        cy="12"
                        r="8"/>
                <path d="m9 9
                         6 6
                         m0-6-6 6"/>
            </svg>
        `;
    }

    function renderWithdrawals() {
        renderMobileWithdrawals();
        renderDesktopWithdrawals();

        const count =
            $("withdrawalCount");

        if (count) {
            count.textContent =
                `${filteredWithdrawals.length} withdrawal${
                    filteredWithdrawals.length === 1
                        ? ""
                        : "s"
                }`;
        }

        const empty =
            $("withdrawalsEmpty");

        if (
            empty &&
            filteredWithdrawals.length === 0
        ) {
            empty.hidden = false;
        } else if (empty) {
            empty.hidden = true;
        }
    }

    function renderMobileWithdrawals() {
        const container =
            $("withdrawalsMobileList");

        if (!container) {
            return;
        }

        if (
            filteredWithdrawals.length === 0
        ) {
            container.innerHTML = "";
            container.hidden = true;
            return;
        }

        container.hidden = false;

        container.innerHTML =
            filteredWithdrawals
                .map(
                    renderWithdrawalCard
                )
                .join("");
    }

    function renderWithdrawalCard(
        item
    ) {
        const id =
            getWithdrawalId(item);

        const name =
            getUserName(item);

        const email =
            getEmail(item);

        const phone =
            getPhone(item);

        const amount =
            getAmount(item);

        const fee =
            getFee(item);

        const payout =
            getPayout(item);

        const method =
            getMethod(item);

        const status =
            getStatus(item);

        const payoutStatus =
            getPayoutStatus(item);

        const date =
            getDate(item);

        return `
            <article
                class="withdrawal-card"
                data-id="${escapeHTML(id)}">

                <div class="withdrawal-card-header">

                    <div class="customer-block">

                        <div class="customer-avatar">
                            ${userIcon()}
                        </div>

                        <div class="customer-info">

                            <h3>
                                ${escapeHTML(name)}
                            </h3>

                            <p>
                                ${phoneIcon()}
                                <span>
                                    ${escapeHTML(phone)}
                                </span>
                            </p>

                            <p>
                                ${mailIcon()}
                                <span>
                                    ${escapeHTML(email)}
                                </span>
                            </p>

                        </div>

                    </div>

                    <span class="
                        status-badge
                        ${statusClass(status)}
                    ">
                        ${clockIcon()}
                        ${escapeHTML(
                            statusLabel(status)
                        )}
                    </span>

                </div>

                <div class="payment-heading">
                    WITHDRAWAL
                </div>

                <div class="payment-summary">

                    <div>
                        <span class="field-label">
                            Requested Amount
                        </span>

                        <strong class="amount-value">
                            ${formatUGX(amount)}
                        </strong>
                    </div>

                    <div>
                        <span class="field-label">
                            Payout Amount
                        </span>

                        <strong class="payout-value">
                            ${formatUGX(payout)}
                        </strong>
                    </div>

                    <div class="
                        method-badge
                        ${methodClass(method)}
                    ">
                        ${escapeHTML(method)}
                    </div>

                </div>

                <div class="withdrawal-info-grid">

                    <div class="info-item">
                        <span>
                            Withdrawal Fee
                        </span>
                        <strong>
                            ${formatUGX(fee)}
                        </strong>
                    </div>

                    <div class="info-item">
                        <span>
                            Submitted
                        </span>
                        <strong>
                            ${escapeHTML(
                                formatDate(date)
                            )}
                        </strong>
                    </div>

                    <div class="info-item">
                        <span>
                            Payment Network
                        </span>
                        <strong>
                            ${escapeHTML(method)}
                        </strong>
                    </div>

                    <div class="info-item">
                        <span>
                            Payout Status
                        </span>
                        <strong class="
                            payout-${escapeHTML(
                                payoutStatus
                            )}
                        ">
                            ${escapeHTML(
                                payoutLabel(
                                    payoutStatus
                                )
                            )}
                        </strong>
                    </div>

                </div>

                <div class="withdrawal-status-row">

                    <span>
                        Withdrawal Status
                    </span>

                    <strong class="
                        ${statusClass(status)}
                    ">
                        ${escapeHTML(
                            statusLabel(status)
                        )}
                    </strong>

                </div>

                <div class="withdrawal-actions">

                    <button
                        type="button"
                        class="view-button"
                        data-action="view"
                        data-id="${escapeHTML(id)}">
                        View Details
                    </button>

                    ${
                        status === "pending"
                            ? `
                                <button
                                    type="button"
                                    class="approve-button"
                                    data-action="approve"
                                    data-id="${escapeHTML(id)}">
                                    ${checkIcon()}
                                    Approve
                                </button>

                                <button
                                    type="button"
                                    class="reject-button"
                                    data-action="reject"
                                    data-id="${escapeHTML(id)}">
                                    ${rejectIcon()}
                                    Reject
                                </button>
                            `
                            : ""
                    }

                </div>

            </article>
        `;
    }

    function renderDesktopWithdrawals() {
        const body =
            $("withdrawalsTableBody");

        if (!body) {
            return;
        }

        if (
            filteredWithdrawals.length === 0
        ) {
            body.innerHTML = "";
            return;
        }

        body.innerHTML =
            filteredWithdrawals
                .map(
                    (item) => {
                        const id =
                            getWithdrawalId(item);

                        const status =
                            getStatus(item);

                        return `
                            <tr>
                                <td>
                                    <div class="table-user">
                                        <span class="table-avatar">
                                            ${userIcon()}
                                        </span>

                                        <span>
                                            ${escapeHTML(
                                                getUserName(item)
                                            )}
                                        </span>
                                    </div>
                                </td>

                                <td>
                                    ${formatUGX(
                                        getAmount(item)
                                    )}
                                </td>

                                <td>
                                    ${formatUGX(
                                        getFee(item)
                                    )}
                                </td>

                                <td class="gold-text">
                                    ${formatUGX(
                                        getPayout(item)
                                    )}
                                </td>

                                <td>
                                    <span class="
                                        method-badge
                                        ${methodClass(
                                            getMethod(item)
                                        )}
                                    ">
                                        ${escapeHTML(
                                            getMethod(item)
                                        )}
                                    </span>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        getPhone(item)
                                    )}
                                </td>

                                <td>
                                    <span class="
                                        status-badge
                                        ${statusClass(status)}
                                    ">
                                        ${escapeHTML(
                                            statusLabel(status)
                                        )}
                                    </span>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        payoutLabel(
                                            getPayoutStatus(item)
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        formatDate(
                                            getDate(item)
                                        )
                                    )}
                                </td>

                                <td>
                                    <button
                                        type="button"
                                        class="table-view-button"
                                        data-action="view"
                                        data-id="${escapeHTML(id)}">
                                        View
                                    </button>
                                </td>
                            </tr>
                        `;
                    }
                )
                .join("");
    }

    function findWithdrawal(id) {
        return withdrawals.find(
            (item) =>
                getWithdrawalId(item) ===
                String(id)
        );
    }

    function openDetails(id) {
        const item =
            findWithdrawal(id);

        if (!item) {
            return;
        }

        const modal =
            $("withdrawalModal");

        if (!modal) {
            return;
        }

        const details =
            $("withdrawalReviewDetails");

        if (details) {
            details.innerHTML = `
                <div class="review-customer">
                    <div class="customer-avatar">
                        ${userIcon()}
                    </div>

                    <div>
                        <strong>
                            ${escapeHTML(
                                getUserName(item)
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                getPhone(item)
                            )}
                        </span>

                        <span>
                            ${escapeHTML(
                                getEmail(item)
                            )}
                        </span>
                    </div>
                </div>

                <div class="review-grid">

                    <div>
                        <span>
                            Requested Amount
                        </span>

                        <strong>
                            ${formatUGX(
                                getAmount(item)
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Withdrawal Fee
                        </span>

                        <strong>
                            ${formatUGX(
                                getFee(item)
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Payout Amount
                        </span>

                        <strong class="gold-text">
                            ${formatUGX(
                                getPayout(item)
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Payment Method
                        </span>

                        <strong>
                            ${escapeHTML(
                                getMethod(item)
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Registered Phone
                        </span>

                        <strong>
                            ${escapeHTML(
                                getPhone(item)
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Withdrawal Status
                        </span>

                        <strong>
                            ${escapeHTML(
                                statusLabel(
                                    getStatus(item)
                                )
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Payout Status
                        </span>

                        <strong>
                            ${escapeHTML(
                                payoutLabel(
                                    getPayoutStatus(item)
                                )
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>
                            Requested Date
                        </span>

                        <strong>
                            ${escapeHTML(
                                formatDate(
                                    getDate(item)
                                )
                            )}
                        </strong>
                    </div>

                </div>
            `;
        }

        modal.dataset.withdrawalId =
            id;

        modal.hidden = false;

        document.body.classList.add(
            "modal-open"
        );
    }

    function closeDetails() {
        const modal =
            $("withdrawalModal");

        if (modal) {
            modal.hidden = true;
        }

        document.body.classList.remove(
            "modal-open"
        );
    }

    async function processWithdrawal(
        id,
        action
    ) {
        const item =
            findWithdrawal(id);

        if (!item) {
            return;
        }

        const name =
            getUserName(item);

        const amount =
            formatUGX(
                getAmount(item)
            );

        const actionText =
            action === "approve"
                ? "approve"
                : "reject";

        const confirmed =
            window.confirm(
                `Are you sure you want to ${actionText} the withdrawal request from ${name} for ${amount}?`
            );

        if (!confirmed) {
            return;
        }

        try {
            showPageMessage(
                `Processing withdrawal ${actionText}...`,
                "info"
            );

            const response =
                await fetchJSON(
                    WITHDRAWALS_API,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            withdrawal_id:
                                id,
                            action:
                                action
                        })
                    }
                );

            if (
                !response ||
                response.success !== true
            ) {
                throw new Error(
                    response?.message ||
                    "Withdrawal action failed."
                );
            }

            showPageMessage(
                response.message ||
                `Withdrawal ${actionText}d successfully.`,
                "success"
            );

            closeDetails();

            await loadWithdrawals();

        } catch (error) {
            console.error(
                "Withdrawal action error:",
                error
            );

            showPageMessage(
                error.message ||
                "Unable to process withdrawal.",
                "error"
            );
        }
    }

    function setupFilters() {
        const search =
            $("withdrawalSearch");

        if (search) {
            search.addEventListener(
                "input",
                () => {
                    currentSearch =
                        search.value;

                    applyFilters();
                }
            );
        }

        const status =
            $("statusFilter");

        if (status) {
            status.addEventListener(
                "change",
                () => {
                    currentStatus =
                        normalize(
                            status.value
                        ) || "all";

                    applyFilters();
                }
            );
        }

        const method =
            $("methodFilter");

        if (method) {
            method.addEventListener(
                "change",
                () => {
                    currentMethod =
                        method.value ||
                        "all";

                    applyFilters();
                }
            );
        }

        const payout =
            $("payoutStatusFilter");

        if (payout) {
            payout.addEventListener(
                "change",
                () => {
                    currentPayoutStatus =
                        normalize(
                            payout.value
                        ) || "all";

                    applyFilters();
                }
            );
        }

        const refresh =
            $("refreshWithdrawalsBtn");

        if (refresh) {
            refresh.addEventListener(
                "click",
                loadWithdrawals
            );
        }
    }

    function setupActions() {
        document.addEventListener(
            "click",
            (event) => {
                const button =
                    event.target.closest(
                        "[data-action]"
                    );

                if (!button) {
                    return;
                }

                const action =
                    button.dataset.action;

                const id =
                    button.dataset.id;

                if (!id) {
                    return;
                }

                if (
                    action === "view"
                ) {
                    openDetails(id);
                }

                if (
                    action === "approve"
                ) {
                    processWithdrawal(
                        id,
                        "approve"
                    );
                }

                if (
                    action === "reject"
                ) {
                    processWithdrawal(
                        id,
                        "reject"
                    );
                }
            }
        );
    }

    function setupModal() {
        const close =
            $("closeWithdrawalModal");

        if (close) {
            close.addEventListener(
                "click",
                closeDetails
            );
        }

        const cancel =
            $("cancelWithdrawalReview");

        if (cancel) {
            cancel.addEventListener(
                "click",
                closeDetails
            );
        }

        const approve =
            $("approveWithdrawalButton");

        if (approve) {
            approve.addEventListener(
                "click",
                () => {
                    const modal =
                        $("withdrawalModal");

                    if (!modal) {
                        return;
                    }

                    const id =
                        modal.dataset.withdrawalId;

                    processWithdrawal(
                        id,
                        "approve"
                    );
                }
            );
        }

        const reject =
            $("rejectWithdrawalButton");

        if (reject) {
            reject.addEventListener(
                "click",
                () => {
                    const modal =
                        $("withdrawalModal");

                    if (!modal) {
                        return;
                    }

                    const id =
                        modal.dataset.withdrawalId;

                    processWithdrawal(
                        id,
                        "reject"
                    );
                }
            );
        }

        document.addEventListener(
            "click",
            (event) => {
                const modal =
                    $("withdrawalModal");

                if (
                    modal &&
                    event.target === modal
                ) {
                    closeDetails();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Escape"
                ) {
                    closeDetails();
                }
            }
        );
    }

    function removeSidebarCompletely() {
        /*
         * The admin pages should now use
         * the clean mobile/full-width layout.
         */
        const sidebar =
            $("sidebar");

        const overlay =
            $("sidebarOverlay");

        if (sidebar) {
            sidebar.remove();
        }

        if (overlay) {
            overlay.remove();
        }

        document.body.classList.remove(
            "sidebar-open"
        );

        document.body.classList.add(
            "admin-no-sidebar"
        );
    }

    function setupLogout() {
        const logout =
            $("logoutButton");

        if (!logout) {
            return;
        }

        logout.addEventListener(
            "click",
            async () => {
                try {
                    await fetch(
                        `${API_BASE}/logout.php`,
                        {
                            method: "GET",
                            credentials:
                                "include",
                            cache:
                                "no-store"
                        }
                    );
                } catch (error) {
                    console.warn(
                        "Logout request failed:",
                        error
                    );
                }

                window.location.href =
                    "login.html";
            }
        );
    }

    function hideLoader() {
        const loader =
            $("pageLoader");

        if (loader) {
            loader.classList.add(
                "page-loaded"
            );

            setTimeout(
                () => {
                    loader.hidden = true;
                },
                250
            );
        }
    }

    async function init() {
        /*
         * Never leave the user staring
         * at the verification screen.
         */
        hideLoader();

        removeSidebarCompletely();

        setupFilters();
        setupActions();
        setupModal();
        setupLogout();

        /*
         * Verify administrator.
         * Even if verification fails,
         * the loading screen is removed.
         */
        const authorized =
            await verifyAdministrator();

        if (!authorized) {
            return;
        }

        await loadProfile();

        await loadWithdrawals();
    }

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

    window.CrownCashAdminWithdrawals = {
        loadWithdrawals,
        applyFilters,
        openDetails,
        closeDetails
    };
})();