"use strict";


/* =========================================================
   CROWN CASH ADMIN - DEPOSITS
========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

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

let allDeposits = [];

let filteredDeposits = [];

let selectedDeposit = null;

let currentPage = 1;

const ITEMS_PER_PAGE = 10;


/* =========================================================
   ELEMENTS
========================================================= */

const pageLoader =
    document.getElementById("pageLoader");

const depositsMessage =
    document.getElementById("depositsMessage");

const depositsLoading =
    document.getElementById("depositsLoading");

const depositsEmpty =
    document.getElementById("depositsEmpty");

const depositsTableWrapper =
    document.getElementById("depositsTableWrapper");

const depositsTableBody =
    document.getElementById("depositsTableBody");

const mobileDeposits =
    document.getElementById("mobileDeposits");

const pagination =
    document.getElementById("pagination");

const searchDeposits =
    document.getElementById("searchDeposits");

const statusFilter =
    document.getElementById("statusFilter");

const methodFilter =
    document.getElementById("methodFilter");

const refreshDepositsBtn =
    document.getElementById("refreshDepositsBtn");

const depositModal =
    document.getElementById("depositModal");

const closeDepositModal =
    document.getElementById("closeDepositModal");

const approveDepositBtn =
    document.getElementById("approveDepositBtn");

const rejectDepositBtn =
    document.getElementById("rejectDepositBtn");

const paymentVerified =
    document.getElementById("paymentVerified");

const modalMessage =
    document.getElementById("modalMessage");


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeDepositsPage
);


async function initializeDepositsPage() {

    try {

        showLoader();

        const authResult =
            await verifyAdministrator();

        if (!authResult.authorized) {

            showPageError(
                authResult.message ||
                "Administrator verification failed."
            );

            hideLoader();

            return;
        }


        /*
         * Profile information is optional.
         * If profile fails, the deposits page
         * should still continue loading.
         */

        loadAdminProfile();


        await loadDeposits();

    } catch (error) {

        console.error(
            "Admin deposits initialization error:",
            error
        );

        showPageError(
            "Unable to load deposit management. Please refresh the page."
        );

    } finally {

        hideLoader();

    }

}


/* =========================================================
   ADMIN VERIFICATION
========================================================= */

async function verifyAdministrator() {

    try {

        const response =
            await fetch(
                ADMIN_AUTH_API,
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        let data = null;

        try {

            data = await response.json();

        } catch {

            data = null;

        }


        if (!response.ok) {

            return {
                authorized: false,

                status: response.status,

                message:
                    data?.message ||
                    (
                        response.status === 401
                            ? "Your administrator session has expired. Please login again."
                            : "Administrator verification failed."
                    )
            };

        }


        if (
            data &&
            data.success === true &&
            data.authorized === true
        ) {

            return {
                authorized: true,

                data
            };

        }


        return {
            authorized: false,

            status: response.status,

            message:
                data?.message ||
                "Administrator verification failed."
        };


    } catch (error) {

        console.error(
            "Administrator verification error:",
            error
        );

        return {
            authorized: false,

            status: 0,

            message:
                "Unable to contact the administrator security service."
        };

    }

}


/* =========================================================
   LOAD ADMIN PROFILE
========================================================= */

async function loadAdminProfile() {

    try {

        const response =
            await fetch(
                PROFILE_API,
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

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
            data.success !== true ||
            !data.user
        ) {

            return;
        }


        const user =
            data.user;


        const fullName =
            user.full_name ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrator";


        const firstLetter =
            fullName
                .trim()
                .charAt(0)
                .toUpperCase() ||
            "A";


        const adminName =
            document.getElementById(
                "adminName"
            );

        const headerUserName =
            document.getElementById(
                "headerUserName"
            );

        const adminAvatar =
            document.getElementById(
                "adminAvatar"
            );

        const accountAvatar =
            document.getElementById(
                "accountAvatar"
            );

        const adminAccountType =
            document.getElementById(
                "adminAccountType"
            );


        if (adminName) {
            adminName.textContent =
                fullName;
        }


        if (headerUserName) {
            headerUserName.textContent =
                fullName;
        }


        if (adminAvatar) {
            adminAvatar.textContent =
                firstLetter;
        }


        if (accountAvatar) {
            accountAvatar.textContent =
                firstLetter;
        }


        if (adminAccountType) {
            adminAccountType.textContent =
                "Admin Account";
        }

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );

    }

}


/* =========================================================
   LOAD DEPOSITS
========================================================= */

async function loadDeposits() {

    setLoadingState(true);

    clearMessage();


    try {

        const response =
            await fetch(
                DEPOSITS_API,
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            data = null;

        }


        if (!response.ok) {

            const message =
                data?.message ||
                (
                    response.status === 401
                        ? "Administrator session has expired."
                        : response.status === 403
                            ? "Administrator access was denied."
                            : "Unable to load deposits."
                );


            showPageError(message);

            setLoadingState(false);

            return;

        }


        if (
            !data ||
            data.success !== true
        ) {

            showPageError(
                data?.message ||
                "Unable to load deposits."
            );

            setLoadingState(false);

            return;

        }


        allDeposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : [];


        updateStatistics(
            data.stats || {}
        );


        applyFilters();


    } catch (error) {

        console.error(
            "Load deposits error:",
            error
        );

        showPageError(
            "Unable to connect to the deposit service."
        );

    } finally {

        setLoadingState(false);

    }

}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics(stats) {

    const total =
        stats.total_deposits ??
        calculateTotal("all");

    const pending =
        stats.pending_deposits ??
        calculateTotal("pending");

    const approved =
        stats.approved_deposits ??
        calculateTotal("approved");

    const rejected =
        stats.rejected_deposits ??
        calculateTotal("rejected");


    setText(
        "totalDeposits",
        formatCurrency(total)
    );

    setText(
        "pendingDeposits",
        formatCurrency(pending)
    );

    setText(
        "approvedDeposits",
        formatCurrency(approved)
    );

    setText(
        "rejectedDeposits",
        formatCurrency(rejected)
    );

}


function calculateTotal(status) {

    return allDeposits.reduce(
        (total, deposit) => {

            const depositStatus =
                normalizeStatus(
                    deposit.status
                );


            if (
                status !== "all" &&
                depositStatus !== status
            ) {

                return total;

            }


            return total +
                toNumber(
                    deposit.amount
                );

        },
        0
    );

}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        (
            searchDeposits?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const status =
        statusFilter?.value ||
        "all";


    const method =
        methodFilter?.value ||
        "all";


    filteredDeposits =
        allDeposits.filter(
            deposit => {

                const customer =
                    getCustomerName(
                        deposit
                    ).toLowerCase();


                const phone =
                    getPhone(
                        deposit
                    ).toLowerCase();


                const reference =
                    getReference(
                        deposit
                    ).toLowerCase();


                const depositStatus =
                    normalizeStatus(
                        deposit.status
                    );


                const depositMethod =
                    normalizeMethod(
                        deposit.payment_method ||
                        deposit.method
                    );


                const matchesSearch =
                    !search ||
                    customer.includes(search) ||
                    phone.includes(search) ||
                    reference.includes(search);


                const matchesStatus =
                    status === "all" ||
                    depositStatus === status;


                const matchesMethod =
                    method === "all" ||
                    depositMethod === method;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMethod
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

    if (!filteredDeposits.length) {

        depositsTableWrapper.hidden =
            true;

        mobileDeposits.innerHTML =
            "";

        mobileDeposits.style.display =
            "";

        depositsEmpty.hidden =
            false;

        pagination.innerHTML =
            "";

        return;

    }


    depositsEmpty.hidden =
        true;


    const start =
        (
            currentPage - 1
        ) * ITEMS_PER_PAGE;


    const pageItems =
        filteredDeposits.slice(
            start,
            start + ITEMS_PER_PAGE
        );


    depositsTableWrapper.hidden =
        false;


    depositsTableBody.innerHTML =
        pageItems
            .map(renderDesktopRow)
            .join("");


    mobileDeposits.innerHTML =
        pageItems
            .map(renderMobileCard)
            .join("");


    renderPagination();

}


/* =========================================================
   DESKTOP ROW
========================================================= */

function renderDesktopRow(deposit) {

    const id =
        escapeHtml(
            getDepositId(deposit)
        );


    const name =
        escapeHtml(
            getCustomerName(deposit)
        );


    const phone =
        escapeHtml(
            getPhone(deposit) ||
            "Phone not available"
        );


    const amount =
        formatCurrency(
            toNumber(deposit.amount)
        );


    const method =
        normalizeMethod(
            deposit.payment_method ||
            deposit.method
        );


    const reference =
        escapeHtml(
            getReference(deposit) ||
            "—"
        );


    const date =
        formatDate(
            deposit.created_at ||
            deposit.date
        );


    const status =
        normalizeStatus(
            deposit.status
        );


    return `
        <tr>

            <td>

                <div class="customer-cell">

                    <div class="customer-avatar">

                        ${userIcon()}

                    </div>

                    <div class="customer-info">

                        <strong>
                            ${name}
                        </strong>

                        <span>
                            ${phone}
                        </span>

                    </div>

                </div>

            </td>


            <td class="amount-cell">
                ${amount}
            </td>


            <td>

                <span class="method-badge ${method}">

                    ${method === "mtn"
                        ? "MTN Mobile Money"
                        : "Airtel Money"
                    }

                </span>

            </td>


            <td
                class="reference-cell"
                title="${reference}"
            >
                ${reference}
            </td>


            <td>
                ${date}
            </td>


            <td>

                <span class="status-badge ${status}">

                    ${capitalize(status)}

                </span>

            </td>


            <td>

                <button
                    type="button"
                    class="view-button"
                    data-view-deposit="${id}"
                    title="Review deposit"
                    aria-label="Review deposit"
                >

                    ${eyeIcon()}

                </button>

            </td>

        </tr>
    `;

}


/* =========================================================
   MOBILE CARD
========================================================= */

function renderMobileCard(deposit) {

    const id =
        escapeHtml(
            getDepositId(deposit)
        );


    const name =
        escapeHtml(
            getCustomerName(deposit)
        );


    const phone =
        escapeHtml(
            getPhone(deposit) ||
            "Phone not available"
        );


    const amount =
        formatCurrency(
            toNumber(deposit.amount)
        );


    const method =
        normalizeMethod(
            deposit.payment_method ||
            deposit.method
        );


    const reference =
        escapeHtml(
            getReference(deposit) ||
            "—"
        );


    const date =
        formatDate(
            deposit.created_at ||
            deposit.date
        );


    const status =
        normalizeStatus(
            deposit.status
        );


    return `
        <article class="mobile-deposit-card">

            <div class="mobile-deposit-top">

                <div class="mobile-deposit-customer">

                    <div class="customer-avatar">

                        ${userIcon()}

                    </div>

                    <div>

                        <strong>
                            ${name}
                        </strong>

                        <span>
                            ${phone}
                        </span>

                    </div>

                </div>


                <span class="status-badge ${status}">

                    ${capitalize(status)}

                </span>

            </div>


            <div class="mobile-deposit-details">

                <div class="mobile-detail">

                    <span>
                        Amount
                    </span>

                    <strong>
                        ${amount}
                    </strong>

                </div>


                <div class="mobile-detail">

                    <span>
                        Method
                    </span>

                    <strong>
                        ${
                            method === "mtn"
                                ? "MTN"
                                : "Airtel"
                        }
                    </strong>

                </div>


                <div class="mobile-detail">

                    <span>
                        Reference
                    </span>

                    <strong>
                        ${reference}
                    </strong>

                </div>


                <div class="mobile-detail">

                    <span>
                        Date
                    </span>

                    <strong>
                        ${date}
                    </strong>

                </div>

            </div>


            <div class="mobile-deposit-action">

                <button
                    type="button"
                    class="view-button"
                    data-view-deposit="${id}"
                >

                    ${eyeIcon()}

                    <span>
                        Review Deposit
                    </span>

                </button>

            </div>

        </article>
    `;

}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination() {

    const totalPages =
        Math.ceil(
            filteredDeposits.length /
            ITEMS_PER_PAGE
        );


    if (totalPages <= 1) {

        pagination.innerHTML =
            "";

        return;

    }


    let html = "";


    html += `
        <button
            type="button"
            class="page-button"
            data-page="${currentPage - 1}"
            ${currentPage === 1 ? "disabled" : ""}
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
                class="page-button ${
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
            class="page-button"
            data-page="${currentPage + 1}"
            ${currentPage === totalPages ? "disabled" : ""}
        >
            Next
        </button>
    `;


    pagination.innerHTML =
        html;

}


/* =========================================================
   MODAL
========================================================= */

function openDepositModal(deposit) {

    selectedDeposit =
        deposit;


    const status =
        normalizeStatus(
            deposit.status
        );


    setText(
        "modalDepositTitle",
        `Deposit #${getShortId(deposit)}`
    );


    setText(
        "modalCustomer",
        getCustomerName(deposit)
    );


    setText(
        "modalPhone",
        getPhone(deposit) ||
        "Not available"
    );


    setText(
        "modalAmount",
        formatCurrency(
            toNumber(deposit.amount)
        )
    );


    const method =
        normalizeMethod(
            deposit.payment_method ||
            deposit.method
        );


    setText(
        "modalMethod",
        method === "mtn"
            ? "MTN Mobile Money"
            : "Airtel Money"
    );


    setText(
        "modalReference",
        getReference(deposit) ||
        "—"
    );


    setText(
        "modalDate",
        formatDate(
            deposit.created_at ||
            deposit.date
        )
    );


    setText(
        "modalStatus",
        capitalize(status)
    );


    modalMessage.hidden =
        true;


    paymentVerified.checked =
        false;


    const isPending =
        status === "pending";


    paymentVerified.disabled =
        !isPending;


    approveDepositBtn.disabled =
        !isPending;


    rejectDepositBtn.disabled =
        !isPending;


    document.getElementById(
        "verificationBox"
    ).style.display =
        isPending
            ? ""
            : "none";


    depositModal.hidden =
        false;

    document.body.style.overflow =
        "hidden";

}


function closeModal() {

    depositModal.hidden =
        true;

    document.body.style.overflow =
        "";

    selectedDeposit =
        null;

}


/* =========================================================
   APPROVE
========================================================= */

async function approveDeposit() {

    if (!selectedDeposit) {
        return;
    }


    if (!paymentVerified.checked) {

        showModalMessage(
            "Please confirm that you have verified the payment before approving this deposit.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            "Approve this deposit? The customer's balance will be credited after successful approval."
        );


    if (!confirmed) {
        return;
    }


    setModalButtonsDisabled(
        true
    );


    try {

        await submitDepositAction(
            "approve",
            true
        );


    } catch (error) {

        console.error(
            "Approve deposit error:",
            error
        );

        showModalMessage(
            error.message ||
            "Unable to approve this deposit.",
            "error"
        );

    } finally {

        setModalButtonsDisabled(
            false
        );

    }

}


/* =========================================================
   REJECT
========================================================= */

async function rejectDeposit() {

    if (!selectedDeposit) {
        return;
    }


    const confirmed =
        window.confirm(
            "Reject this deposit? This action should only be used when the submitted payment cannot be verified."
        );


    if (!confirmed) {
        return;
    }


    setModalButtonsDisabled(
        true
    );


    try {

        await submitDepositAction(
            "reject",
            false
        );


    } catch (error) {

        console.error(
            "Reject deposit error:",
            error
        );

        showModalMessage(
            error.message ||
            "Unable to reject this deposit.",
            "error"
        );

    } finally {

        setModalButtonsDisabled(
            false
        );

    }

}


/* =========================================================
   SUBMIT ACTION
========================================================= */

async function submitDepositAction(
    action,
    verified
) {

    const depositId =
        getDepositId(
            selectedDeposit
        );


    const response =
        await fetch(
            DEPOSITS_API,
            {
                method: "POST",

                credentials: "include",

                cache: "no-store",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body: JSON.stringify({

                    deposit_id:
                        depositId,

                    action:
                        action,

                    payment_verified:
                        verified

                })
            }
        );


    let data = null;


    try {

        data =
            await response.json();

    } catch {

        data = null;

    }


    if (!response.ok) {

        throw new Error(
            data?.message ||
            (
                response.status === 401
                    ? "Administrator session has expired."
                    : response.status === 403
                        ? "Administrator access was denied."
                        : "Deposit action failed."
            )
        );

    }


    if (
        !data ||
        data.success !== true
    ) {

        throw new Error(
            data?.message ||
            "Deposit action failed."
        );

    }


    showPageMessage(
        data.message ||
        (
            action === "approve"
                ? "Deposit approved successfully."
                : "Deposit rejected successfully."
        ),
        "success"
    );


    closeModal();


    await loadDeposits();

}


/* =========================================================
   EVENTS
========================================================= */

searchDeposits?.addEventListener(
    "input",
    debounce(
        applyFilters,
        180
    )
);


statusFilter?.addEventListener(
    "change",
    applyFilters
);


methodFilter?.addEventListener(
    "change",
    applyFilters
);


refreshDepositsBtn?.addEventListener(
    "click",
    loadDeposits
);


closeDepositModal?.addEventListener(
    "click",
    closeModal
);


approveDepositBtn?.addEventListener(
    "click",
    approveDeposit
);


rejectDepositBtn?.addEventListener(
    "click",
    rejectDeposit
);


depositModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            depositModal
        ) {

            closeModal();

        }

    }
);


document.addEventListener(
    "click",
    event => {

        const viewButton =
            event.target.closest(
                "[data-view-deposit]"
            );


        if (viewButton) {

            const id =
                viewButton.dataset
                    .viewDeposit;


            const deposit =
                allDeposits.find(
                    item =>
                        String(
                            getDepositId(item)
                        ) === String(id)
                );


            if (deposit) {

                openDepositModal(
                    deposit
                );

            }

        }


        const pageButton =
            event.target.closest(
                "[data-page]"
            );


        if (
            pageButton &&
            pagination.contains(
                pageButton
            )
        ) {

            const page =
                Number(
                    pageButton.dataset.page
                );


            if (
                page >= 1 &&
                page <= Math.ceil(
                    filteredDeposits.length /
                    ITEMS_PER_PAGE
                )
            ) {

                currentPage =
                    page;

                renderDeposits();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }

        }

    }
);


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

const sidebar =
    document.getElementById(
        "sidebar"
    );

const sidebarOverlay =
    document.getElementById(
        "sidebarOverlay"
    );

const menuButton =
    document.getElementById(
        "menuButton"
    );


function openSidebar() {

    sidebar?.classList.add(
        "open"
    );

    sidebarOverlay?.classList.add(
        "show"
    );

}


function closeSidebar() {

    sidebar?.classList.remove(
        "open"
    );

    sidebarOverlay?.classList.remove(
        "show"
    );

}


menuButton?.addEventListener(
    "click",
    openSidebar
);


sidebarOverlay?.addEventListener(
    "click",
    closeSidebar
);


document
    .querySelectorAll(".nav-link")
    .forEach(link => {

        link.addEventListener(
            "click",
            closeSidebar
        );

    });


/* =========================================================
   LOGOUT
========================================================= */

document
    .getElementById("logoutBtn")
    ?.addEventListener(
        "click",
        async () => {

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmed) {
                return;
            }


            try {

                await fetch(
                    LOGOUT_API,
                    {
                        method: "POST",

                        credentials: "include",

                        cache: "no-store",

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            } catch (error) {

                console.warn(
                    "Logout request failed:",
                    error
                );

            } finally {

                window.location.href =
                    "login.html";

            }

        }
    );


/* =========================================================
   LOADING STATE
========================================================= */

function setLoadingState(
    loading
) {

    if (depositsLoading) {

        depositsLoading.hidden =
            !loading;

    }


    if (loading) {

        depositsTableWrapper.hidden =
            true;

        depositsEmpty.hidden =
            true;

        if (mobileDeposits) {
            mobileDeposits.innerHTML =
                "";
        }

    }

}


/* =========================================================
   LOADER
========================================================= */

function showLoader() {

    pageLoader?.classList.remove(
        "hidden"
    );

}


function hideLoader() {

    setTimeout(
        () => {

            pageLoader?.classList.add(
                "hidden"
            );

        },
        120
    );

}


/* =========================================================
   PAGE MESSAGE
========================================================= */

function showPageMessage(
    message,
    type = "info"
) {

    if (!depositsMessage) {
        return;
    }


    depositsMessage.textContent =
        message;


    depositsMessage.className =
        `admin-message ${type}`;


    depositsMessage.hidden =
        false;

}


function showPageError(
    message
) {

    showPageMessage(
        message,
        "error"
    );

}


function clearMessage() {

    if (!depositsMessage) {
        return;
    }

    depositsMessage.hidden =
        true;

}


/* =========================================================
   MODAL MESSAGE
========================================================= */

function showModalMessage(
    message,
    type = "error"
) {

    modalMessage.textContent =
        message;

    modalMessage.className =
        `modal-message ${type}`;

    modalMessage.hidden =
        false;

}


/* =========================================================
   BUTTON STATE
========================================================= */

function setModalButtonsDisabled(
    disabled
) {

    approveDepositBtn.disabled =
        disabled;

    rejectDepositBtn.disabled =
        disabled;

    approveDepositBtn.style.opacity =
        disabled ? "0.55" : "";

    rejectDepositBtn.style.opacity =
        disabled ? "0.55" : "";

}


/* =========================================================
   HELPERS
========================================================= */

function getDepositId(
    deposit
) {

    return String(
        deposit?.id ??
        deposit?._id ??
        deposit?.deposit_id ??
        ""
    );

}


function getShortId(
    deposit
) {

    const id =
        getDepositId(
            deposit
        );

    return id
        ? id.slice(-8)
        : "—";

}


function getCustomerName(
    deposit
) {

    return (
        deposit?.full_name ||
        deposit?.user_name ||
        deposit?.customer_name ||
        deposit?.name ||
        [
            deposit?.first_name,
            deposit?.last_name
        ]
            .filter(Boolean)
            .join(" ") ||
        "Customer"
    );

}


function getPhone(
    deposit
) {

    return String(
        deposit?.phone ??
        deposit?.phone_number ??
        deposit?.mobile ??
        ""
    );

}


function getReference(
    deposit
) {

    return String(
        deposit?.transaction_reference ??
        deposit?.reference ??
        deposit?.payment_reference ??
        deposit?.transaction_id ??
        ""
    );

}


function normalizeStatus(
    value
) {

    const status =
        String(
            value || "pending"
        )
            .trim()
            .toLowerCase();


    if (
        status === "complete" ||
        status === "completed"
    ) {

        return "approved";

    }


    return [
        "pending",
        "approved",
        "rejected"
    ].includes(status)
        ? status
        : "pending";

}


function normalizeMethod(
    value
) {

    const method =
        String(
            value || ""
        )
            .trim()
            .toLowerCase();


    if (
        method.includes("mtn")
    ) {

        return "mtn";

    }


    return "airtel";

}


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
        typeof value === "number"
    ) {

        return value;

    }


    if (
        typeof value === "object"
    ) {

        if (
            value.$numberDecimal
        ) {

            return Number(
                value.$numberDecimal
            );

        }


        if (
            value.$numberLong
        ) {

            return Number(
                value.$numberLong
            );

        }


        if (
            value.value !== undefined
        ) {

            return Number(
                value.value
            );

        }

    }


    const number =
        Number(
            String(value)
                .replace(
                    /,/g,
                    ""
                )
        );


    return Number.isFinite(number)
        ? number
        : 0;

}


function formatCurrency(
    value
) {

    return (
        "UGX " +
        new Intl.NumberFormat(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        ).format(
            toNumber(value)
        )
    );

}


function formatDate(
    value
) {

    if (!value) {
        return "—";
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

        return "—";

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

}


function capitalize(
    value
) {

    const text =
        String(
            value || ""
        );


    return text.charAt(0)
        .toUpperCase() +
        text.slice(1);

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function debounce(
    callback,
    delay
) {

    let timer;

    return function (...args) {

        clearTimeout(timer);

        timer =
            setTimeout(
                () => callback.apply(
                    this,
                    args
                ),
                delay
            );

    };

}


/* =========================================================
   SVG ICONS
========================================================= */

function userIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >

            <circle
                cx="12"
                cy="8"
                r="3"
            ></circle>

            <path
                d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"
            ></path>

        </svg>
    `;

}


function eyeIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >

            <path
                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
            ></path>

            <circle
                cx="12"
                cy="12"
                r="2.5"
            ></circle>

        </svg>
    `;

}


/* =========================================================
   GLOBAL ADMIN DEPOSITS API
========================================================= */

window.CrownCashAdminDeposits = {

    loadDeposits,

    applyFilters,

    openDepositModal,

    closeModal,

    getDeposits: () =>
        allDeposits

};