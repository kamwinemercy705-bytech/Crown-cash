/* =========================================================
   CROWN CASH - ADMIN DEPOSITS
   Clean administrator deposit management
   ========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

const DEPOSITS_API =
    `${API_BASE}/admin-deposits.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


let deposits = [];

let filteredDeposits = [];

let currentPage = 1;

const PER_PAGE = 10;

let administratorVerified = false;


/* =========================================================
   DOM
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   HTML ESCAPE
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
   CURRENCY
   ========================================================= */

function formatCurrency(value) {

    const number =
        Number(value || 0);

    return "UGX " +
        number.toLocaleString("en-UG", {
            maximumFractionDigits: 0
        });
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
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


/* =========================================================
   STATUS
   ========================================================= */

function normalizeStatus(status) {

    return String(
        status || "pending"
    )
        .trim()
        .toLowerCase();
}


/* =========================================================
   METHOD
   ========================================================= */

function normalizeMethod(method) {

    const value =
        String(method || "")
            .trim()
            .toLowerCase();

    if (
        value.includes("mtn")
    ) {
        return "MTN Mobile Money";
    }

    if (
        value.includes("airtel")
    ) {
        return "Airtel Money";
    }

    return method || "Unknown";
}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function statusBadge(status) {

    const value =
        normalizeStatus(status);

    let label = "Pending";

    if (value === "approved") {
        label = "Approved";
    }

    if (value === "rejected") {
        label = "Rejected";
    }

    return `
        <span class="status-badge status-${escapeHTML(value)}">
            ${escapeHTML(label)}
        </span>
    `;
}


/* =========================================================
   API
   ========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const response =
        await fetch(url, {

            ...options,

            credentials: "include",

            cache: "no-store",

            headers: {

                "Accept":
                    "application/json",

                ...(options.body
                    ? {
                        "Content-Type":
                            "application/json"
                    }
                    : {}),

                ...(options.headers || {})
            }
        });

    let data = {};

    try {
        data =
            await response.json();
    } catch (error) {
        data = {};
    }

    return {
        response,
        data
    };
}


/* =========================================================
   PAGE MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "error"
) {

    const box =
        $("depositsMessage");

    if (!box) {
        return;
    }

    box.textContent =
        message;

    box.className =
        `admin-message ${type}`;

    box.style.display =
        "block";
}


function hideMessage() {

    const box =
        $("depositsMessage");

    if (!box) {
        return;
    }

    box.style.display =
        "none";
}


/* =========================================================
   LOADER
   ========================================================= */

function hidePageLoader() {

    const loader =
        $("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    setTimeout(() => {

        loader.style.display =
            "none";

    }, 250);
}


/* =========================================================
   ADMINISTRATOR VERIFICATION
   =========================================================

   IMPORTANT:

   We intentionally do NOT call admin-auth.php here.

   admin-deposits.php performs the administrator
   authentication itself.

   This prevents the page from failing because two
   different endpoints disagree about the session.
   ========================================================= */

async function verifyAdministrator() {

    try {

        const {
            response,
            data
        } = await apiRequest(
            DEPOSITS_API,
            {
                method: "GET"
            }
        );

        if (
            response.status === 401
        ) {

            administratorVerified =
                false;

            showMessage(
                data.message ||
                "Administrator session has expired. Please login again.",
                "error"
            );

            return false;
        }


        if (
            response.status === 403
        ) {

            administratorVerified =
                false;

            showMessage(
                data.message ||
                "This account is not authorized to manage deposits.",
                "error"
            );

            return false;
        }


        if (
            !response.ok ||
            data.success !== true
        ) {

            administratorVerified =
                false;

            showMessage(
                data.message ||
                "Administrator verification failed.",
                "error"
            );

            return false;
        }


        administratorVerified =
            true;

        hideMessage();

        /*
         * Save the already-loaded deposits so we
         * do not immediately make another request.
         */

        deposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : [];


        updateStatistics(
            data.statistics || {}
        );

        applyFilters();

        return true;

    } catch (error) {

        console.error(
            "Administrator verification error:",
            error
        );

        administratorVerified =
            false;

        showMessage(
            "Unable to connect to the administrator deposit service.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const {
            response,
            data
        } = await apiRequest(
            PROFILE_API,
            {
                method: "GET"
            }
        );

        if (
            !response.ok ||
            data.success !== true
        ) {
            return;
        }

        const user =
            data.user || {};

        const name =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`
                .trim() ||
            "Administrator";

        if ($("adminName")) {
            $("adminName").textContent =
                name;
        }

        if ($("headerUserName")) {
            $("headerUserName").textContent =
                name;
        }

        if ($("adminAccountType")) {
            $("adminAccountType").textContent =
                user.account_type ||
                "Admin Account";
        }

        const initial =
            name
                .charAt(0)
                .toUpperCase() ||
            "A";

        if ($("adminAvatar")) {
            $("adminAvatar").textContent =
                initial;
        }

        if ($("accountAvatar")) {
            $("accountAvatar").textContent =
                initial;
        }

    } catch (error) {

        console.warn(
            "Profile loading failed:",
            error
        );
    }
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics(
    statistics
) {

    let total =
        Number(
            statistics.total_amount || 0
        );

    let pending =
        Number(
            statistics.pending_amount || 0
        );

    let approved =
        Number(
            statistics.approved_amount || 0
        );

    let rejected =
        Number(
            statistics.rejected_amount || 0
        );


    /*
     * Safety fallback.
     */

    if (
        !statistics ||
        Object.keys(statistics).length === 0
    ) {

        total = 0;
        pending = 0;
        approved = 0;
        rejected = 0;

        deposits.forEach(
            deposit => {

                const amount =
                    Number(
                        deposit.amount || 0
                    );

                const status =
                    normalizeStatus(
                        deposit.status
                    );

                total += amount;

                if (
                    status === "pending"
                ) {
                    pending += amount;
                }

                if (
                    status === "approved"
                ) {
                    approved += amount;
                }

                if (
                    status === "rejected"
                ) {
                    rejected += amount;
                }
            }
        );
    }


    if ($("totalDeposits")) {
        $("totalDeposits").textContent =
            formatCurrency(total);
    }

    if ($("pendingDeposits")) {
        $("pendingDeposits").textContent =
            formatCurrency(pending);
    }

    if ($("approvedDeposits")) {
        $("approvedDeposits").textContent =
            formatCurrency(approved);
    }

    if ($("rejectedDeposits")) {
        $("rejectedDeposits").textContent =
            formatCurrency(rejected);
    }
}


/* =========================================================
   FILTER
   ========================================================= */

function applyFilters() {

    const search =
        ($("searchDeposits")?.value || "")
            .trim()
            .toLowerCase();

    const status =
        ($("statusFilter")?.value || "all")
            .toLowerCase();

    const method =
        ($("methodFilter")?.value || "all")
            .toLowerCase();


    filteredDeposits =
        deposits.filter(
            deposit => {

                const customer =
                    deposit.customer_name ||
                    deposit.full_name ||
                    "Customer";

                const email =
                    deposit.email || "";

                const phone =
                    deposit.phone || "";

                const reference =
                    deposit.reference ||
                    deposit.transaction_reference ||
                    "";

                const paymentMethod =
                    normalizeMethod(
                        deposit.payment_method
                    );

                const depositStatus =
                    normalizeStatus(
                        deposit.status
                    );


                const searchable =
                    `
                    ${customer}
                    ${email}
                    ${phone}
                    ${reference}
                    ${paymentMethod}
                    `
                    .toLowerCase();


                const searchMatch =
                    !search ||
                    searchable.includes(
                        search
                    );


                const statusMatch =
                    status === "all" ||
                    depositStatus === status;


                let methodMatch = true;


                if (
                    method === "mtn"
                ) {

                    methodMatch =
                        paymentMethod
                            .toLowerCase()
                            .includes("mtn");
                }


                if (
                    method === "airtel"
                ) {

                    methodMatch =
                        paymentMethod
                            .toLowerCase()
                            .includes("airtel");
                }


                return (
                    searchMatch &&
                    statusMatch &&
                    methodMatch
                );
            }
        );


    currentPage = 1;

    renderDeposits();
}


/* =========================================================
   RENDER
   ========================================================= */

function renderDeposits() {

    const body =
        $("depositsTableBody");

    const empty =
        $("depositsEmpty");

    const loading =
        $("depositsLoading");


    if (loading) {
        loading.style.display =
            "none";
    }


    if (!filteredDeposits.length) {

        if (body) {
            body.innerHTML = "";
        }

        if (empty) {
            empty.style.display =
                "flex";
        }

        renderPagination();

        return;
    }


    if (empty) {
        empty.style.display =
            "none";
    }


    const start =
        (currentPage - 1) *
        PER_PAGE;

    const end =
        start + PER_PAGE;


    const items =
        filteredDeposits.slice(
            start,
            end
        );


    if (!body) {
        return;
    }


    body.innerHTML =
        items.map(
            deposit => {

                const id =
                    deposit.id ||
                    deposit.deposit_id ||
                    deposit._id ||
                    "";

                const customer =
                    deposit.customer_name ||
                    deposit.full_name ||
                    "Customer";

                const email =
                    deposit.email ||
                    deposit.phone ||
                    "—";

                const amount =
                    Number(
                        deposit.amount || 0
                    );

                const method =
                    normalizeMethod(
                        deposit.payment_method
                    );

                const reference =
                    deposit.reference ||
                    deposit.transaction_reference ||
                    "—";

                const status =
                    normalizeStatus(
                        deposit.status
                    );


                return `
                    <tr>

                        <td>

                            <div class="deposit-customer">

                                <div class="deposit-avatar">
                                    ${escapeHTML(
                                        customer
                                            .charAt(0)
                                            .toUpperCase()
                                    )}
                                </div>

                                <div>

                                    <strong>
                                        ${escapeHTML(
                                            customer
                                        )}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            email
                                        )}
                                    </small>

                                </div>

                            </div>

                        </td>


                        <td>
                            <strong>
                                ${formatCurrency(
                                    amount
                                )}
                            </strong>
                        </td>


                        <td>
                            ${escapeHTML(
                                method
                            )}
                        </td>


                        <td>

                            <span class="deposit-reference">
                                ${escapeHTML(
                                    reference
                                )}
                            </span>

                        </td>


                        <td>
                            ${statusBadge(
                                status
                            )}
                        </td>


                        <td>
                            ${escapeHTML(
                                formatDate(
                                    deposit.created_at
                                )
                            )}
                        </td>


                        <td>

                            <div class="deposit-actions">

                                <button
                                    type="button"
                                    class="action-button view"
                                    data-action="view"
                                    data-id="${escapeHTML(
                                        id
                                    )}"
                                >

                                    <svg viewBox="0 0 24 24">
                                        <path
                                            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                                        />
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="2.5"
                                        />
                                    </svg>

                                    View

                                </button>


                                ${
                                    status === "pending"
                                        ? `

                                            <button
                                                type="button"
                                                class="action-button approve"
                                                data-action="approve"
                                                data-id="${escapeHTML(
                                                    id
                                                )}"
                                            >

                                                <svg viewBox="0 0 24 24">
                                                    <path
                                                        d="m5 12 4 4L19 6"
                                                    />
                                                </svg>

                                                Approve

                                            </button>


                                            <button
                                                type="button"
                                                class="action-button reject"
                                                data-action="reject"
                                                data-id="${escapeHTML(
                                                    id
                                                )}"
                                            >

                                                <svg viewBox="0 0 24 24">
                                                    <path
                                                        d="m7 7 10 10M17 7 7 17"
                                                    />
                                                </svg>

                                                Reject

                                            </button>

                                        `
                                        : ""
                                }

                            </div>

                        </td>

                    </tr>
                `;
            }
        )
        .join("");


    attachActions();

    renderPagination();
}


/* =========================================================
   ACTIONS
   ========================================================= */

function attachActions() {

    document
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const action =
                            button.dataset.action;

                        const id =
                            button.dataset.id;


                        if (
                            action === "view"
                        ) {
                            viewDeposit(id);
                        }


                        if (
                            action === "approve"
                        ) {
                            viewDeposit(
                                id,
                                true
                            );
                        }


                        if (
                            action === "reject"
                        ) {
                            processDeposit(
                                id,
                                "reject"
                            );
                        }

                    }
                );
            }
        );
}


/* =========================================================
   FIND DEPOSIT
   ========================================================= */

function findDeposit(id) {

    return deposits.find(
        deposit => {

            const depositId =
                deposit.id ||
                deposit.deposit_id ||
                deposit._id ||
                "";

            return String(
                depositId
            ) === String(id);
        }
    );
}


/* =========================================================
   REVIEW
   ========================================================= */

function viewDeposit(
    id,
    directApproval = false
) {

    const deposit =
        findDeposit(id);

    if (!deposit) {

        showMessage(
            "Deposit could not be found.",
            "error"
        );

        return;
    }


    const customer =
        deposit.customer_name ||
        deposit.full_name ||
        "Customer";

    const email =
        deposit.email ||
        "—";

    const phone =
        deposit.phone ||
        "—";

    const amount =
        Number(
            deposit.amount || 0
        );

    const method =
        normalizeMethod(
            deposit.payment_method
        );

    const reference =
        deposit.reference ||
        deposit.transaction_reference ||
        "—";

    const status =
        normalizeStatus(
            deposit.status
        );

    const verified =
        deposit.payment_verified === true;


    const oldModal =
        document.getElementById(
            "depositReviewModal"
        );

    oldModal?.remove();


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "depositReviewModal";

    modal.className =
        "deposit-review-modal";


    modal.innerHTML = `

        <div class="deposit-review-overlay"></div>


        <div class="deposit-review-box">


            <button
                type="button"
                class="deposit-review-close"
                id="closeDepositReview"
            >

                <svg viewBox="0 0 24 24">
                    <path
                        d="m7 7 10 10M17 7 7 17"
                    />
                </svg>

            </button>


            <div class="deposit-review-icon">

                <svg viewBox="0 0 24 24">

                    <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="3"
                    />

                    <path d="M3 10h18"/>

                    <path d="M7 15h3"/>

                </svg>

            </div>


            <h3>
                Deposit Review
            </h3>


            <p class="deposit-review-subtitle">
                Review this payment before processing it.
            </p>


            <div class="deposit-review-details">

                <div>
                    <span>Customer</span>
                    <strong>
                        ${escapeHTML(customer)}
                    </strong>
                </div>


                <div>
                    <span>Amount</span>
                    <strong>
                        ${formatCurrency(amount)}
                    </strong>
                </div>


                <div>
                    <span>Email</span>
                    <strong>
                        ${escapeHTML(email)}
                    </strong>
                </div>


                <div>
                    <span>Phone</span>
                    <strong>
                        ${escapeHTML(phone)}
                    </strong>
                </div>


                <div>
                    <span>Payment Method</span>
                    <strong>
                        ${escapeHTML(method)}
                    </strong>
                </div>


                <div>
                    <span>Reference</span>
                    <strong>
                        ${escapeHTML(reference)}
                    </strong>
                </div>


                <div>
                    <span>Date</span>
                    <strong>
                        ${escapeHTML(
                            formatDate(
                                deposit.created_at
                            )
                        )}
                    </strong>
                </div>


                <div>
                    <span>Status</span>
                    <strong>
                        ${statusBadge(status)}
                    </strong>
                </div>

            </div>


            ${
                status === "pending"
                    ? `

                        <label
                            class="payment-verification"
                        >

                            <input
                                type="checkbox"
                                id="paymentVerifiedCheck"
                                ${
                                    verified
                                        ? "checked"
                                        : ""
                                }
                            >

                            <span>
                                I have manually verified this
                                payment reference in the relevant
                                mobile-money records.
                            </span>

                        </label>


                        <div class="deposit-review-actions">

                            <button
                                type="button"
                                class="action-button reject"
                                id="modalRejectDeposit"
                            >

                                <svg viewBox="0 0 24 24">
                                    <path
                                        d="m7 7 10 10M17 7 7 17"
                                    />
                                </svg>

                                Reject

                            </button>


                            <button
                                type="button"
                                class="action-button approve"
                                id="modalApproveDeposit"
                            >

                                <svg viewBox="0 0 24 24">
                                    <path
                                        d="m5 12 4 4L19 6"
                                    />
                                </svg>

                                Approve Deposit

                            </button>

                        </div>

                    `
                    : `

                        <div class="deposit-review-actions">

                            <button
                                type="button"
                                class="action-button view"
                                id="closeDepositReviewBottom"
                            >
                                Close
                            </button>

                        </div>

                    `
            }

        </div>
    `;


    document.body.appendChild(
        modal
    );


    function closeModal() {
        modal.remove();
    }


    $("closeDepositReview")
        ?.addEventListener(
            "click",
            closeModal
        );


    modal
        .querySelector(
            ".deposit-review-overlay"
        )
        ?.addEventListener(
            "click",
            closeModal
        );


    $("closeDepositReviewBottom")
        ?.addEventListener(
            "click",
            closeModal
        );


    $("modalRejectDeposit")
        ?.addEventListener(
            "click",
            async () => {

                closeModal();

                await processDeposit(
                    id,
                    "reject"
                );
            }
        );


    $("modalApproveDeposit")
        ?.addEventListener(
            "click",
            async () => {

                const checked =
                    $("paymentVerifiedCheck")
                        ?.checked;


                if (!checked) {

                    showMessage(
                        "Please confirm payment verification before approving this deposit.",
                        "error"
                    );

                    return;
                }


                closeModal();


                await processDeposit(
                    id,
                    "approve"
                );
            }
        );


    if (directApproval) {

        setTimeout(
            () => {

                $("modalApproveDeposit")
                    ?.focus();

            },
            50
        );
    }
}


/* =========================================================
   PROCESS
   ========================================================= */

async function processDeposit(
    id,
    action
) {

    const deposit =
        findDeposit(id);

    if (!deposit) {

        showMessage(
            "Deposit could not be found.",
            "error"
        );

        return;
    }


    if (
        action === "approve"
    ) {

        /*
         * Approval is intentionally only possible
         * through the review modal where the admin
         * confirms payment verification.
         */

        viewDeposit(id);

        return;
    }


    const customer =
        deposit.customer_name ||
        deposit.full_name ||
        "Customer";


    const amount =
        Number(
            deposit.amount || 0
        );


    const confirmed =
        window.confirm(
            `Reject ${formatCurrency(
                amount
            )} deposit for ${customer}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        showMessage(
            "Rejecting deposit...",
            "info"
        );


        const {
            response,
            data
        } = await apiRequest(
            DEPOSITS_API,
            {

                method: "POST",

                body: JSON.stringify({

                    deposit_id:
                        id,

                    action:
                        "reject"

                })

            }
        );


        if (
            response.status === 401
        ) {

            administratorVerified =
                false;

            showMessage(
                data.message ||
                "Administrator session has expired.",
                "error"
            );

            return;
        }


        if (
            response.status === 403
        ) {

            showMessage(
                data.message ||
                "You are not authorized to reject deposits.",
                "error"
            );

            return;
        }


        if (
            !response.ok ||
            data.success !== true
        ) {

            showMessage(
                data.message ||
                "Unable to reject deposit.",
                "error"
            );

            return;
        }


        showMessage(
            data.message ||
            "Deposit rejected successfully.",
            "success"
        );


        await reloadDeposits();


    } catch (error) {

        console.error(
            "Deposit rejection error:",
            error
        );

        showMessage(
            "Unable to process the deposit.",
            "error"
        );
    }
}


/* =========================================================
   APPROVE FROM MODAL
   ========================================================= */

async function approveDeposit(
    id
) {

    const deposit =
        findDeposit(id);

    if (!deposit) {
        return;
    }


    const customer =
        deposit.customer_name ||
        deposit.full_name ||
        "Customer";


    const amount =
        Number(
            deposit.amount || 0
        );


    try {

        showMessage(
            "Approving deposit...",
            "info"
        );


        const {
            response,
            data
        } = await apiRequest(
            DEPOSITS_API,
            {

                method: "POST",

                body: JSON.stringify({

                    deposit_id:
                        id,

                    action:
                        "approve",

                    payment_verified:
                        true

                })

            }
        );


        if (
            response.status === 401
        ) {

            administratorVerified =
                false;

            showMessage(
                data.message ||
                "Administrator session has expired.",
                "error"
            );

            return;
        }


        if (
            response.status === 403
        ) {

            showMessage(
                data.message ||
                "You are not authorized to approve deposits.",
                "error"
            );

            return;
        }


        if (
            !response.ok ||
            data.success !== true
        ) {

            showMessage(
                data.message ||
                "Unable to approve deposit.",
                "error"
            );

            return;
        }


        showMessage(
            data.message ||
            `${formatCurrency(
                amount
            )} deposit for ${customer} approved successfully.`,
            "success"
        );


        await reloadDeposits();


    } catch (error) {

        console.error(
            "Deposit approval error:",
            error
        );

        showMessage(
            "Unable to approve the deposit.",
            "error"
        );
    }
}


/* =========================================================
   RELOAD
   ========================================================= */

async function reloadDeposits() {

    try {

        const {
            response,
            data
        } = await apiRequest(
            DEPOSITS_API,
            {
                method: "GET"
            }
        );


        if (
            !response.ok ||
            data.success !== true
        ) {

            showMessage(
                data.message ||
                "Unable to refresh deposits.",
                "error"
            );

            return;
        }


        deposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : [];


        updateStatistics(
            data.statistics || {}
        );


        applyFilters();


    } catch (error) {

        console.error(
            "Reload error:",
            error
        );

        showMessage(
            "Unable to refresh deposits.",
            "error"
        );
    }
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("depositsPagination");

    if (!container) {
        return;
    }


    const totalPages =
        Math.ceil(
            filteredDeposits.length /
            PER_PAGE
        );


    if (
        totalPages <= 1
    ) {

        container.innerHTML =
            "";

        return;
    }


    let html = "";


    html += `
        <button
            type="button"
            class="pagination-button"
            data-page="${currentPage - 1}"
            ${
                currentPage === 1
                    ? "disabled"
                    : ""
            }
        >
            Previous
        </button>
    `;


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        html += `
            <button
                type="button"
                class="pagination-button ${
                    page === currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>
        `;
    }


    html += `
        <button
            type="button"
            class="pagination-button"
            data-page="${currentPage + 1}"
            ${
                currentPage === totalPages
                    ? "disabled"
                    : ""
            }
        >
            Next
        </button>
    `;


    container.innerHTML =
        html;


    container
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const page =
                            Number(
                                button.dataset.page
                            );


                        if (
                            page < 1 ||
                            page > totalPages
                        ) {
                            return;
                        }


                        currentPage =
                            page;

                        renderDeposits();
                    }
                );
            }
        );
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    const sidebar =
        $("sidebar");

    const overlay =
        $("sidebarOverlay");

    const menu =
        $("menuButton");

    const close =
        $("sidebarClose");


    function open() {

        sidebar
            ?.classList
            .add("active");

        overlay
            ?.classList
            .add("active");
    }


    function hide() {

        sidebar
            ?.classList
            .remove("active");

        overlay
            ?.classList
            .remove("active");
    }


    menu?.addEventListener(
        "click",
        open
    );

    close?.addEventListener(
        "click",
        hide
    );

    overlay?.addEventListener(
        "click",
        hide
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        await fetch(
            LOGOUT_API,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request error:",
            error
        );

    } finally {

        window.location.href =
            "login.html";
    }
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    $("searchDeposits")
        ?.addEventListener(
            "input",
            applyFilters
        );


    $("statusFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("methodFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("refreshDepositsBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (!administratorVerified) {

                    const verified =
                        await verifyAdministrator();

                    if (!verified) {
                        return;
                    }

                } else {

                    await reloadDeposits();
                }
            }
        );


    $("logoutBtn")
        ?.addEventListener(
            "click",
            logout
        );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initialize() {

    try {

        /*
         * The actual deposit API verifies the admin.
         */

        const verified =
            await verifyAdministrator();


        if (verified) {

            await loadAdminProfile();

        }

    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );

        showMessage(
            "Unable to initialize deposit management.",
            "error"
        );

    } finally {

        hidePageLoader();
    }
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();

        setupEvents();

        initialize();

    }
);


/* =========================================================
   GLOBAL
   ========================================================= */

window.CrownCashAdminDeposits = {

    verifyAdministrator,

    loadAdminProfile,

    reloadDeposits,

    applyFilters,

    viewDeposit,

    processDeposit,

    approveDeposit

};