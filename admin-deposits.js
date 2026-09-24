"use strict";

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Deposit Management
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const DEPOSITS_API =
    `${API_BASE}/admin-deposits.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   STATE
========================================================= */

const depositState = {

    deposits: [],

    filteredDeposits: [],

    currentPage: 1,

    itemsPerPage: 10,

    selectedDeposit: null,

    loading: false,

    processing: false

};


/* =========================================================
   DOM HELPERS
========================================================= */

function getElement(id) {

    return document.getElementById(id);
}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeAdminDeposits
);


async function initializeAdminDeposits() {

    setupSidebar();

    setupFilters();

    setupModal();

    setupLogout();

    await verifyAdmin();

}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

async function verifyAdmin() {

    try {

        const response = await fetch(
            ADMIN_AUTH_API,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        let data = null;

        try {

            data = await response.json();

        } catch (error) {

            data = null;

        }


        if (
            response.status === 401 ||
            response.status === 403 ||
            !data ||
            data.authorized !== true
        ) {

            window.location.href =
                "login.html";

            return false;
        }


        await loadAdminProfile();

        await loadDeposits();

        hidePageLoader();

        return true;


    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );


        showDepositMessage(
            "Unable to verify administrator access.",
            "error"
        );


        setTimeout(
            () => {
                window.location.href =
                    "login.html";
            },
            1500
        );


        return false;
    }
}


/* =========================================================
   ADMIN PROFILE
========================================================= */

async function loadAdminProfile() {

    try {

        const response = await fetch(
            PROFILE_API,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (!response.ok) {
            return;
        }


        const data =
            await response.json();


        if (
            !data ||
            data.success !== true
        ) {
            return;
        }


        const user =
            data.user || {};


        const fullName =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Administrator";


        const firstName =
            user.first_name ||
            fullName.split(" ")[0] ||
            "Administrator";


        const email =
            user.email ||
            "";


        const accountType =
            user.account_type ||
            user.role ||
            "admin";


        setText(
            "adminName",
            fullName
        );


        setText(
            "headerUserName",
            fullName
        );


        setText(
            "adminAccountType",
            formatAccountType(accountType)
        );


        setAvatar(
            "adminAvatar",
            firstName
        );


        setAvatar(
            "accountAvatar",
            firstName
        );


        /*
        |--------------------------------------------------------------------------
        | Some admin layouts may have an admin email element.
        |--------------------------------------------------------------------------
        */

        const adminEmail =
            getElement("adminEmail");


        if (adminEmail) {

            adminEmail.textContent =
                email;
        }


    } catch (error) {

        console.error(
            "Unable to load admin profile:",
            error
        );
    }
}


/* =========================================================
   LOAD DEPOSITS
========================================================= */

async function loadDeposits() {

    if (depositState.loading) {
        return;
    }


    depositState.loading = true;

    showDepositsLoading();


    try {

        const response = await fetch(
            DEPOSITS_API,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;

        }


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.href =
                "login.html";

            return;
        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to load deposits."
            );
        }


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load deposits."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Accept several possible response structures.
        |--------------------------------------------------------------------------
        */

        const deposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : Array.isArray(data.data)
                    ? data.data
                    : [];


        depositState.deposits =
            deposits.map(
                normalizeDeposit
            );


        depositState.currentPage =
            1;


        updateDepositStatistics(
            data,
            depositState.deposits
        );


        applyDepositFilters();


    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );


        depositState.deposits =
            [];

        depositState.filteredDeposits =
            [];


        renderDeposits();


        showDepositMessage(
            error.message ||
            "Unable to load deposits.",
            "error"
        );


    } finally {

        depositState.loading =
            false;
    }
}


/* =========================================================
   NORMALIZE DEPOSIT
========================================================= */

function normalizeDeposit(
    deposit
) {

    const user =
        deposit.user ||
        {};


    const userName =
        deposit.user_name ||
        deposit.full_name ||
        user.full_name ||
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        deposit.name ||
        "Unknown User";


    const email =
        deposit.email ||
        user.email ||
        "";


    const phone =
        deposit.phone ||
        deposit.phone_number ||
        user.phone ||
        "";


    const id =
        deposit.id ||
        deposit._id ||
        deposit.deposit_id ||
        "";


    const amount =
        toNumber(
            deposit.amount ||
            deposit.deposit_amount ||
            0
        );


    const method =
        deposit.payment_method ||
        deposit.method ||
        deposit.paymentMethod ||
        "Unknown";


    const reference =
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.transaction_ref ||
        deposit.payment_reference ||
        "";


    const status =
        String(
            deposit.status ||
            "pending"
        ).toLowerCase();


    const createdAt =
        deposit.created_at ||
        deposit.createdAt ||
        deposit.date ||
        deposit.submitted_at ||
        "";


    return {

        ...deposit,

        id: String(id),

        user_name:
            userName,

        email:
            email,

        phone:
            phone,

        amount:
            amount,

        payment_method:
            normalizePaymentMethod(method),

        reference:
            String(reference),

        status:
            status,

        created_at:
            createdAt

    };
}


/* =========================================================
   UPDATE STATISTICS
========================================================= */

function updateDepositStatistics(
    data,
    deposits
) {

    /*
    |--------------------------------------------------------------------------
    | If backend provides statistics, use them.
    |--------------------------------------------------------------------------
    */

    const stats =
        data.stats ||
        data.statistics ||
        {};


    const totalAmount =
        toNumber(
            stats.total_deposits ??
            data.total_deposits ??
            data.total_amount ??
            calculateAmount(
                deposits
            )
        );


    const pendingAmount =
        toNumber(
            stats.pending_deposits ??
            data.pending_deposits ??
            calculateAmount(
                deposits.filter(
                    deposit =>
                        deposit.status === "pending"
                )
            )
        );


    const approvedAmount =
        toNumber(
            stats.approved_deposits ??
            data.approved_deposits ??
            calculateAmount(
                deposits.filter(
                    deposit =>
                        deposit.status === "approved"
                )
            )
        );


    const rejectedAmount =
        toNumber(
            stats.rejected_deposits ??
            data.rejected_deposits ??
            calculateAmount(
                deposits.filter(
                    deposit =>
                        deposit.status === "rejected"
                )
            )
        );


    setText(
        "totalDeposits",
        formatCurrency(
            totalAmount
        )
    );


    setText(
        "pendingDeposits",
        formatCurrency(
            pendingAmount
        )
    );


    setText(
        "approvedDeposits",
        formatCurrency(
            approvedAmount
        )
    );


    setText(
        "rejectedDeposits",
        formatCurrency(
            rejectedAmount
        )
    );
}


/* =========================================================
   FILTER SETUP
========================================================= */

function setupFilters() {

    const search =
        getElement(
            "searchDeposits"
        );


    const status =
        getElement(
            "statusFilter"
        );


    const method =
        getElement(
            "methodFilter"
        );


    if (search) {

        search.addEventListener(
            "input",
            debounce(
                () => {

                    depositState.currentPage =
                        1;

                    applyDepositFilters();

                },
                250
            )
        );
    }


    if (status) {

        status.addEventListener(
            "change",
            () => {

                depositState.currentPage =
                    1;

                applyDepositFilters();
            }
        );
    }


    if (method) {

        method.addEventListener(
            "change",
            () => {

                depositState.currentPage =
                    1;

                applyDepositFilters();
            }
        );
    }


    const refreshButton =
        getElement(
            "refreshDepositsBtn"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                refreshButton.disabled =
                    true;

                await loadDeposits();

                refreshButton.disabled =
                    false;
            }
        );
    }
}


/* =========================================================
   APPLY FILTERS
========================================================= */

function applyDepositFilters() {

    const search =
        String(
            getElement(
                "searchDeposits"
            )?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const status =
        String(
            getElement(
                "statusFilter"
            )?.value ||
            "all"
        )
        .toLowerCase();


    const method =
        String(
            getElement(
                "methodFilter"
            )?.value ||
            "all"
        )
        .toLowerCase();


    depositState.filteredDeposits =
        depositState.deposits.filter(
            deposit => {

                const searchText = [

                    deposit.user_name,

                    deposit.email,

                    deposit.phone,

                    deposit.reference,

                    deposit.id,

                    deposit.payment_method

                ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchText.includes(
                        search
                    );


                const matchesStatus =
                    status === "all" ||
                    deposit.status === status;


                const matchesMethod =
                    method === "all" ||
                    deposit.payment_method
                        .toLowerCase()
                        .includes(
                            method
                        );


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMethod
                );
            }
        );


    renderDeposits();
}


/* =========================================================
   RENDER DEPOSITS
========================================================= */

function renderDeposits() {

    const tbody =
        getElement(
            "depositsTableBody"
        );


    const loading =
        getElement(
            "depositsLoading"
        );


    const empty =
        getElement(
            "depositsEmpty"
        );


    if (!tbody) {
        return;
    }


    if (loading) {
        loading.style.display =
            "none";
    }


    const deposits =
        depositState.filteredDeposits;


    if (!deposits.length) {

        tbody.innerHTML =
            "";


        if (empty) {

            empty.style.display =
                "block";
        }


        renderPagination();

        return;
    }


    if (empty) {

        empty.style.display =
            "none";
    }


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                deposits.length /
                depositState.itemsPerPage
            )
        );


    if (
        depositState.currentPage >
        totalPages
    ) {

        depositState.currentPage =
            totalPages;
    }


    const start =
        (
            depositState.currentPage -
            1
        ) *
        depositState.itemsPerPage;


    const end =
        start +
        depositState.itemsPerPage;


    const pageItems =
        deposits.slice(
            start,
            end
        );


    tbody.innerHTML =
        pageItems
            .map(
                renderDepositRow
            )
            .join("");


    bindDepositRowButtons();

    renderPagination();
}


/* =========================================================
   RENDER TABLE ROW
========================================================= */

function renderDepositRow(
    deposit
) {

    const initials =
        getInitials(
            deposit.user_name
        );


    const statusClass =
        getStatusClass(
            deposit.status
        );


    const statusLabel =
        capitalize(
            deposit.status
        );


    const method =
        escapeHTML(
            deposit.payment_method
        );


    const reference =
        escapeHTML(
            deposit.reference ||
            "—"
        );


    return `

        <tr>

            <td>

                <div class="deposit-user">

                    <div
                        class="deposit-user-avatar"
                    >
                        ${escapeHTML(initials)}
                    </div>

                    <div
                        class="deposit-user-info"
                    >

                        <span
                            class="deposit-user-name"
                        >
                            ${escapeHTML(
                                deposit.user_name
                            )}
                        </span>

                        <span
                            class="deposit-user-email"
                        >
                            ${escapeHTML(
                                deposit.email ||
                                deposit.phone ||
                                "No contact"
                            )}
                        </span>

                    </div>

                </div>

            </td>


            <td>

                <span class="deposit-amount">

                    ${formatCurrency(
                        deposit.amount
                    )}

                </span>

            </td>


            <td>

                <span class="deposit-method">

                    <span class="method-dot"></span>

                    ${method}

                </span>

            </td>


            <td>

                <span>
                    ${reference}
                </span>

            </td>


            <td>

                <span>
                    ${formatDate(
                        deposit.created_at
                    )}
                </span>

            </td>


            <td>

                <span
                    class="deposit-status ${statusClass}"
                >

                    <span
                        class="deposit-status-dot"
                    ></span>

                    ${escapeHTML(
                        statusLabel
                    )}

                </span>

            </td>


            <td>

                <div class="deposit-actions">

                    <button
                        type="button"
                        class="deposit-action-btn view"
                        data-deposit-action="view"
                        data-deposit-id="${escapeHTML(
                            deposit.id
                        )}"
                        title="View deposit"
                        aria-label="View deposit"
                    >

                        <svg viewBox="0 0 24 24">

                            <path
                                d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
                            />

                            <circle
                                cx="12"
                                cy="12"
                                r="2.5"
                            />

                        </svg>

                    </button>


                    ${
                        deposit.status === "pending"
                            ? `

                        <button
                            type="button"
                            class="deposit-action-btn approve"
                            data-deposit-action="approve"
                            data-deposit-id="${escapeHTML(
                                deposit.id
                            )}"
                            title="Approve deposit"
                            aria-label="Approve deposit"
                        >

                            <svg viewBox="0 0 24 24">

                                <path
                                    d="M5 12l4 4L19 6"
                                />

                            </svg>

                        </button>


                        <button
                            type="button"
                            class="deposit-action-btn reject"
                            data-deposit-action="reject"
                            data-deposit-id="${escapeHTML(
                                deposit.id
                            )}"
                            title="Reject deposit"
                            aria-label="Reject deposit"
                        >

                            <svg viewBox="0 0 24 24">

                                <path
                                    d="M7 7l10 10"
                                />

                                <path
                                    d="M17 7L7 17"
                                />

                            </svg>

                        </button>

                    `
                            : ""
                    }

                </div>

            </td>

        </tr>
    `;
}


/* =========================================================
   BIND ROW BUTTONS
========================================================= */

function bindDepositRowButtons() {

    document
        .querySelectorAll(
            "[data-deposit-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const action =
                            button.dataset
                                .depositAction;


                        const depositId =
                            button.dataset
                                .depositId;


                        const deposit =
                            depositState.deposits
                                .find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            depositId
                                        )
                                );


                        if (!deposit) {

                            showDepositMessage(
                                "Deposit could not be found.",
                                "error"
                            );

                            return;
                        }


                        if (
                            action ===
                            "view"
                        ) {

                            openDepositModal(
                                deposit
                            );

                            return;
                        }


                        if (
                            action ===
                            "approve"
                        ) {

                            await approveDeposit(
                                deposit
                            );

                            return;
                        }


                        if (
                            action ===
                            "reject"
                        ) {

                            await rejectDeposit(
                                deposit
                            );
                        }
                    }
                );
            }
        );
}


/* =========================================================
   OPEN DETAILS MODAL
========================================================= */

function openDepositModal(
    deposit
) {

    depositState.selectedDeposit =
        deposit;


    setText(
        "modalDepositUser",
        deposit.user_name
    );


    setText(
        "modalDepositAmount",
        formatCurrency(
            deposit.amount
        )
    );


    setText(
        "modalDepositMethod",
        deposit.payment_method
    );


    setText(
        "modalDepositStatus",
        capitalize(
            deposit.status
        )
    );


    setText(
        "modalDepositReference",
        deposit.reference ||
        "—"
    );


    setText(
        "modalDepositPhone",
        deposit.phone ||
        "—"
    );


    setText(
        "modalDepositDate",
        formatDate(
            deposit.created_at
        )
    );


    setText(
        "modalDepositId",
        deposit.id ||
        "—"
    );


    const actions =
        getElement(
            "modalDepositActions"
        );


    if (actions) {

        actions.style.display =
            deposit.status === "pending"
                ? "flex"
                : "none";
    }


    const modal =
        getElement(
            "depositModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );
}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeDepositModal() {

    const modal =
        getElement(
            "depositModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );


    depositState.selectedDeposit =
        null;
}


/* =========================================================
   MODAL SETUP
========================================================= */

function setupModal() {

    const closeButton =
        getElement(
            "closeDepositModal"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeDepositModal
        );
    }


    const modal =
        getElement(
            "depositModal"
        );


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeDepositModal();
                }
            }
        );
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeDepositModal();
            }
        }
    );


    const approveButton =
        getElement(
            "modalApproveDepositBtn"
        );


    if (approveButton) {

        approveButton.addEventListener(
            "click",
            async () => {

                if (
                    depositState.selectedDeposit
                ) {

                    await approveDeposit(
                        depositState.selectedDeposit
                    );
                }
            }
        );
    }


    const rejectButton =
        getElement(
            "modalRejectDepositBtn"
        );


    if (rejectButton) {

        rejectButton.addEventListener(
            "click",
            async () => {

                if (
                    depositState.selectedDeposit
                ) {

                    await rejectDeposit(
                        depositState.selectedDeposit
                    );
                }
            }
        );
    }
}


/* =========================================================
   APPROVE DEPOSIT
========================================================= */

async function approveDeposit(
    deposit
) {

    if (
        !deposit ||
        deposit.status !== "pending"
    ) {

        showDepositMessage(
            "Only pending deposits can be approved.",
            "error"
        );

        return;
    }


    const confirmed =
        window.confirm(
            `Approve this deposit of ${formatCurrency(
                deposit.amount
            )} for ${deposit.user_name}?`
        );


    if (!confirmed) {
        return;
    }


    await processDeposit(
        deposit,
        "approve"
    );
}


/* =========================================================
   REJECT DEPOSIT
========================================================= */

async function rejectDeposit(
    deposit
) {

    if (
        !deposit ||
        deposit.status !== "pending"
    ) {

        showDepositMessage(
            "Only pending deposits can be rejected.",
            "error"
        );

        return;
    }


    const confirmed =
        window.confirm(
            `Reject this deposit of ${formatCurrency(
                deposit.amount
            )} for ${deposit.user_name}?`
        );


    if (!confirmed) {
        return;
    }


    await processDeposit(
        deposit,
        "reject"
    );
}


/* =========================================================
   PROCESS DEPOSIT
========================================================= */

async function processDeposit(
    deposit,
    action
) {

    if (
        depositState.processing
    ) {

        return;
    }


    depositState.processing =
        true;


    setDepositActionButtonsDisabled(
        true
    );


    showDepositMessage(
        action === "approve"
            ? "Approving deposit..."
            : "Rejecting deposit...",
        "info"
    );


    try {

        /*
        |--------------------------------------------------------------------------
        | The backend accepts POST JSON:
        | {
        |     deposit_id: "...",
        |     action: "approve"
        | }
        |--------------------------------------------------------------------------
        */

        const response =
            await fetch(
                DEPOSITS_API,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            deposit_id:
                                deposit.id,

                            action:
                                action
                        })
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;
        }


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            showDepositMessage(
                data?.message ||
                "Administrator authorization failed.",
                "error"
            );


            setTimeout(
                () => {

                    window.location.href =
                        "login.html";

                },
                1200
            );


            return;
        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to process deposit."
            );
        }


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to process deposit."
            );
        }


        showDepositMessage(
            data.message ||
            (
                action === "approve"
                    ? "Deposit approved successfully."
                    : "Deposit rejected successfully."
            ),
            "success"
        );


        closeDepositModal();


        /*
        |--------------------------------------------------------------------------
        | Reload from the server so the displayed
        | balance/status cannot become stale.
        |--------------------------------------------------------------------------
        */

        await loadDeposits();


    } catch (error) {

        console.error(
            "Deposit processing error:",
            error
        );


        showDepositMessage(
            error.message ||
            "Unable to process deposit.",
            "error"
        );


    } finally {

        depositState.processing =
            false;

        setDepositActionButtonsDisabled(
            false
        );
    }
}


/* =========================================================
   DISABLE ACTION BUTTONS
========================================================= */

function setDepositActionButtonsDisabled(
    disabled
) {

    document
        .querySelectorAll(
            ".deposit-action-btn, .modal-action"
        )
        .forEach(
            button => {

                button.disabled =
                    disabled;
            }
        );
}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination() {

    const container =
        getElement(
            "depositsPagination"
        );


    if (!container) {
        return;
    }


    const total =
        depositState.filteredDeposits
            .length;


    const totalPages =
        Math.ceil(
            total /
            depositState.itemsPerPage
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
            data-page="previous"
            ${depositState.currentPage === 1
                ? "disabled"
                : ""}
        >
            ‹
        </button>
    `;


    const maxVisiblePages =
        5;


    let startPage =
        Math.max(
            1,
            depositState.currentPage -
            2
        );


    let endPage =
        Math.min(
            totalPages,
            startPage +
            maxVisiblePages -
            1
        );


    if (
        endPage -
        startPage +
        1 <
        maxVisiblePages
    ) {

        startPage =
            Math.max(
                1,
                endPage -
                maxVisiblePages +
                1
            );
    }


    for (
        let page = startPage;
        page <= endPage;
        page++
    ) {

        html += `

            <button
                type="button"
                class="pagination-button ${
                    page === depositState.currentPage
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
            data-page="next"
            ${
                depositState.currentPage ===
                totalPages
                    ? "disabled"
                    : ""
            }
        >
            ›
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

                        const value =
                            button.dataset.page;


                        if (
                            value ===
                            "previous"
                        ) {

                            if (
                                depositState.currentPage >
                                1
                            ) {

                                depositState.currentPage--;
                            }

                        } else if (
                            value ===
                            "next"
                        ) {

                            if (
                                depositState.currentPage <
                                totalPages
                            ) {

                                depositState.currentPage++;
                            }

                        } else {

                            depositState.currentPage =
                                Number(value);
                        }


                        renderDeposits();


                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });
                    }
                );
            }
        );
}


/* =========================================================
   LOADING STATE
========================================================= */

function showDepositsLoading() {

    const tbody =
        getElement(
            "depositsTableBody"
        );


    const loading =
        getElement(
            "depositsLoading"
        );


    const empty =
        getElement(
            "depositsEmpty"
        );


    if (tbody) {

        tbody.innerHTML =
            "";
    }


    if (loading) {

        loading.style.display =
            "block";
    }


    if (empty) {

        empty.style.display =
            "none";
    }
}


/* =========================================================
   SIDEBAR
========================================================= */

function setupSidebar() {

    const sidebar =
        getElement(
            "sidebar"
        );


    const overlay =
        getElement(
            "sidebarOverlay"
        );


    const menuButton =
        getElement(
            "menuButton"
        );


    const closeButton =
        getElement(
            "sidebarClose"
        );


    if (
        menuButton &&
        sidebar
    ) {

        menuButton.addEventListener(
            "click",
            () => {

                sidebar.classList.add(
                    "open"
                );


                if (overlay) {

                    overlay.classList.add(
                        "show"
                    );
                }
            }
        );
    }


    if (
        closeButton &&
        sidebar
    ) {

        closeButton.addEventListener(
            "click",
            closeSidebar
        );
    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    document
        .querySelectorAll(
            ".admin-nav-link"
        )
        .forEach(
            link => {

                link.addEventListener(
                    "click",
                    () => {

                        if (
                            window.innerWidth <=
                            900
                        ) {

                            closeSidebar();
                        }
                    }
                );
            }
        );
}


function closeSidebar() {

    const sidebar =
        getElement(
            "sidebar"
        );


    const overlay =
        getElement(
            "sidebarOverlay"
        );


    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );
    }


    if (overlay) {

        overlay.classList.remove(
            "show"
        );
    }
}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    const logoutButton =
        getElement(
            "logoutBtn"
        );


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
        "click",
        async () => {

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmed) {
                return;
            }


            logoutButton.disabled =
                true;


            try {

                await fetch(
                    LOGOUT_API,
                    {
                        method: "POST",

                        credentials: "include",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({})
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
   PAGE LOADER
========================================================= */

function hidePageLoader() {

    const loader =
        getElement(
            "pageLoader"
        );


    if (!loader) {
        return;
    }


    loader.classList.add(
        "hidden"
    );


    setTimeout(
        () => {

            loader.style.display =
                "none";

        },
        350
    );
}


/* =========================================================
   MESSAGE
========================================================= */

function showDepositMessage(
    message,
    type = "info"
) {

    const element =
        getElement(
            "depositMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `deposit-message show ${type}`;


    if (
        type === "success"
    ) {

        setTimeout(
            () => {

                element.classList.remove(
                    "show"
                );

            },
            5000
        );
    }
}


/* =========================================================
   TEXT HELPER
========================================================= */

function setText(
    id,
    value
) {

    const element =
        getElement(id);


    if (element) {

        element.textContent =
            value ??
            "";
    }
}


/* =========================================================
   AVATAR
========================================================= */

function setAvatar(
    id,
    name
) {

    const element =
        getElement(id);


    if (!element) {
        return;
    }


    element.textContent =
        getInitials(
            name
        );
}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function toNumber(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return 0;
    }


    if (
        typeof value ===
        "number"
    ) {

        return Number.isFinite(value)
            ? value
            : 0;
    }


    if (
        typeof value ===
        "object"
    ) {

        if (
            typeof value.$numberDecimal ===
            "string"
        ) {

            return (
                parseFloat(
                    value.$numberDecimal
                ) ||
                0
            );
        }


        if (
            typeof value.toString ===
            "function"
        ) {

            return (
                parseFloat(
                    value.toString()
                ) ||
                0
            );
        }
    }


    return (
        parseFloat(
            String(value)
                .replace(/,/g, "")
        ) ||
        0
    );
}


function calculateAmount(
    deposits
) {

    return deposits.reduce(
        (
            total,
            deposit
        ) => {

            return (
                total +
                toNumber(
                    deposit.amount
                )
            );

        },
        0
    );
}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(
    amount
) {

    const number =
        toNumber(amount);


    return (
        "UGX " +
        new Intl.NumberFormat(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        ).format(number)
    );
}


/* =========================================================
   DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    let date;


    try {

        if (
            typeof value ===
            "object" &&
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

            return String(value);
        }


        return new Intl.DateTimeFormat(
            "en-UG",
            {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);


    } catch (error) {

        return String(value);
    }
}


/* =========================================================
   PAYMENT METHOD
========================================================= */

function normalizePaymentMethod(
    method
) {

    const value =
        String(
            method ||
            ""
        )
        .trim()
        .toLowerCase();


    if (
        value.includes("mtn")
    ) {

        return "MTN";
    }


    if (
        value.includes("airtel")
    ) {

        return "Airtel";
    }


    return capitalize(
        value ||
        "Unknown"
    );
}


/* =========================================================
   STATUS
========================================================= */

function getStatusClass(
    status
) {

    const value =
        String(
            status ||
            "pending"
        ).toLowerCase();


    if (
        value === "approved" ||
        value === "completed" ||
        value === "success"
    ) {

        return "approved";
    }


    if (
        value === "rejected" ||
        value === "failed" ||
        value === "cancelled"
    ) {

        return "rejected";
    }


    return "pending";
}


/* =========================================================
   ACCOUNT TYPE
========================================================= */

function formatAccountType(
    value
) {

    const text =
        String(
            value ||
            "admin"
        )
        .replace(/[_-]/g, " ");


    return text
        .replace(
            /\b\w/g,
            character =>
               