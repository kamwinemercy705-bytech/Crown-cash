"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_CHECK_URL =
    `${API_BASE}/admin-check.php`;

const DEPOSITS_API_URL =
    `${API_BASE}/admin-deposits.php`;

let allDeposits = [];


// =====================================================
// ADMIN AUTHENTICATION
// =====================================================

async function verifyAdminAccess() {

    try {

        const response = await fetch(
            ADMIN_CHECK_URL,
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
        } catch (error) {
            data = null;
        }

        if (
            !response.ok ||
            !data ||
            data.success !== true ||
            data.authenticated !== true ||
            data.authorized !== true
        ) {

            window.location.replace(
                "/login.html?admin=login_required"
            );

            return false;
        }

        return true;

    } catch (error) {

        console.error(
            "Administrator verification failed:",
            error
        );

        window.location.replace(
            "/login.html?admin=login_required"
        );

        return false;
    }
}


// =====================================================
// LOAD DEPOSITS
// =====================================================

async function loadDeposits() {

    try {

        showLoading();

        const response = await fetch(
            DEPOSITS_API_URL,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.replace(
                "/login.html?admin=login_required"
            );

            return;
        }


        const data =
            await response.json();


        if (
            !response.ok ||
            data.success !== true
        ) {

            throw new Error(
                data.message ||
                "Unable to load deposits."
            );
        }


        allDeposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : [];


        renderStatistics(
            data.stats || {}
        );

        renderDeposits();

    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );

        showError(
            error.message ||
            "Unable to load deposits."
        );
    }
}


// =====================================================
// STATISTICS
// =====================================================

function renderStatistics(stats) {

    const total =
        document.getElementById("totalDeposits");

    const pending =
        document.getElementById("pendingDeposits");

    const approved =
        document.getElementById("approvedDeposits");

    const rejected =
        document.getElementById("rejectedDeposits");


    if (total) {

        total.textContent =
            Number(
                stats.total || 0
            ).toLocaleString();
    }


    if (pending) {

        pending.textContent =
            Number(
                stats.pending || 0
            ).toLocaleString();
    }


    if (approved) {

        approved.textContent =
            Number(
                stats.approved || 0
            ).toLocaleString();
    }


    if (rejected) {

        rejected.textContent =
            Number(
                stats.rejected || 0
            ).toLocaleString();
    }
}


// =====================================================
// RENDER DEPOSITS
// =====================================================

function renderDeposits() {

    const tableBody =
        document.getElementById(
            "depositsTableBody"
        );


    if (!tableBody) {
        return;
    }


    const searchInput =
        document.getElementById(
            "searchDeposits"
        );


    const statusFilter =
        document.getElementById(
            "statusFilter"
        );


    const methodFilter =
        document.getElementById(
            "methodFilter"
        );


    const search =
        (
            searchInput?.value ||
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


    const filtered =
        allDeposits.filter(deposit => {

            const searchable =
                [
                    deposit.full_name,
                    deposit.email,
                    deposit.phone,
                    deposit.reference,
                    deposit.transaction_reference,
                    deposit.method
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


            if (
                search &&
                !searchable.includes(search)
            ) {
                return false;
            }


            const depositStatus =
                String(
                    deposit.status ||
                    "pending"
                ).toLowerCase();


            if (
                status !== "all" &&
                depositStatus !==
                    status.toLowerCase()
            ) {
                return false;
            }


            const depositMethod =
                String(
                    deposit.method ||
                    ""
                ).toLowerCase();


            if (
                method !== "all" &&
                depositMethod !==
                    method.toLowerCase()
            ) {
                return false;
            }


            return true;
        });


    if (!filtered.length) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="empty-state"
                >
                    No deposits found.
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        filtered.map(deposit => {

            const id =
                escapeHtml(
                    String(
                        deposit.id ||
                        deposit._id ||
                        ""
                    )
                );


            const name =
                escapeHtml(
                    String(
                        deposit.full_name ||
                        "Unknown User"
                    )
                );


            const amount =
                formatMoney(
                    deposit.amount
                );


            const methodText =
                escapeHtml(
                    String(
                        deposit.method ||
                        "N/A"
                    )
                );


            const phone =
                escapeHtml(
                    String(
                        deposit.phone ||
                        ""
                    )
                );


            const reference =
                escapeHtml(
                    String(
                        deposit.reference ||
                        deposit.transaction_reference ||
                        "N/A"
                    )
                );


            const statusValue =
                String(
                    deposit.status ||
                    "pending"
                ).toLowerCase();


            const date =
                formatDate(
                    deposit.created_at
                );


            return `
                <tr>

                    <td>
                        ${name}
                    </td>

                    <td>
                        <strong>
                            UGX ${amount}
                        </strong>
                    </td>

                    <td>
                        ${methodText}
                    </td>

                    <td>
                        ${phone}
                    </td>

                    <td>
                        ${reference}
                    </td>

                    <td>
                        <span
                            class="status-badge ${escapeHtml(statusValue)}"
                        >
                            ${escapeHtml(statusValue)}
                        </span>
                    </td>

                    <td>
                        ${date}
                    </td>

                    <td>

                        ${
                            statusValue === "pending"
                            ? `
                                <div class="deposit-actions">

                                    <button
                                        type="button"
                                        class="action-btn approve-btn"
                                        data-action="approve"
                                        data-id="${id}"
                                    >
                                        Approve
                                    </button>

                                    <button
                                        type="button"
                                        class="action-btn reject-btn"
                                        data-action="reject"
                                        data-id="${id}"
                                    >
                                        Reject
                                    </button>

                                </div>
                            `
                            : `
                                <button
                                    type="button"
                                    class="action-btn view-btn"
                                    data-action="view"
                                    data-id="${id}"
                                >
                                    View
                                </button>
                            `
                        }

                    </td>

                </tr>
            `;

        }).join("");
}


// =====================================================
// VIEW DEPOSIT
// =====================================================

function viewDeposit(depositId) {

    const deposit =
        allDeposits.find(
            item =>
                String(
                    item.id ||
                    item._id
                ) ===
                String(depositId)
        );


    if (!deposit) {

        showToast(
            "Deposit was not found.",
            "error"
        );

        return;
    }


    const details = [

        `User: ${deposit.full_name || "N/A"}`,
        `Email: ${deposit.email || "N/A"}`,
        `Phone: ${deposit.phone || "N/A"}`,
        `Amount: UGX ${formatMoney(deposit.amount)}`,
        `Method: ${deposit.method || "N/A"}`,
        `Reference: ${
            deposit.reference ||
            deposit.transaction_reference ||
            "N/A"
        }`,
        `Status: ${deposit.status || "N/A"}`,
        `Date: ${formatDate(deposit.created_at)}`

    ].join("\n");


    alert(details);
}


// =====================================================
// APPROVE / REJECT DEPOSIT
// =====================================================

async function updateDeposit(
    depositId,
    action
) {

    const actionText =
        action === "approve"
            ? "approve"
            : "reject";


    const confirmed =
        confirm(
            `Are you sure you want to ${actionText} this deposit?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response = await fetch(
            DEPOSITS_API_URL,
            {
                method: "POST",
                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body: JSON.stringify({

                    action:
                        action,

                    deposit_id:
                        depositId,

                    /*
                     * Deposit approval should only
                     * happen after the administrator
                     * has verified the payment.
                     */
                    payment_verified:
                        action === "approve"
                })
            }
        );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.replace(
                "/login.html?admin=login_required"
            );

            return;
        }


        const data =
            await response.json();


        if (
            !response.ok ||
            data.success !== true
        ) {

            throw new Error(
                data.message ||
                `Unable to ${actionText} deposit.`
            );
        }


        showToast(
            data.message ||
            `Deposit ${actionText}d successfully.`,
            "success"
        );


        await loadDeposits();

    } catch (error) {

        console.error(
            "Deposit action error:",
            error
        );

        showToast(
            error.message ||
            `Unable to ${actionText} deposit.`,
            "error"
        );
    }
}


// =====================================================
// EVENT HANDLERS
// =====================================================

function setupEventHandlers() {

    const searchInput =
        document.getElementById(
            "searchDeposits"
        );


    const statusFilter =
        document.getElementById(
            "statusFilter"
        );


    const methodFilter =
        document.getElementById(
            "methodFilter"
        );


    const refreshButton =
        document.getElementById(
            "refreshDeposits"
        );


    const logoutButton =
        document.getElementById(
            "logoutBtn"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderDeposits
        );
    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderDeposits
        );
    }


    if (methodFilter) {

        methodFilter.addEventListener(
            "change",
            renderDeposits
        );
    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            loadDeposits
        );
    }


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                try {

                    await fetch(
                        `${API_BASE}/logout.php`,
                        {
                            method: "GET",
                            credentials: "include"
                        }
                    );

                } catch (error) {

                    console.error(error);

                } finally {

                    window.location.replace(
                        "/login.html"
                    );
                }
            }
        );
    }


    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-action]"
                );


            if (!button) {
                return;
            }


            const action =
                button.dataset.action;


            const depositId =
                button.dataset.id;


            if (action === "view") {

                viewDeposit(
                    depositId
                );

            } else if (
                action === "approve" ||
                action === "reject"
            ) {

                updateDeposit(
                    depositId,
                    action
                );
            }
        }
    );
}


// =====================================================
// UI HELPERS
// =====================================================

function showLoading() {

    const tableBody =
        document.getElementById(
            "depositsTableBody"
        );


    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>
            <td
                colspan="9"
                class="loading-state"
            >
                Checking administrator access...
            </td>
        </tr>
    `;
}


function showError(message) {

    const tableBody =
        document.getElementById(
            "depositsTableBody"
        );


    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>
            <td
                colspan="9"
                class="error-state"
            >
                ${escapeHtml(message)}
            </td>
        </tr>
    `;
}


function showToast(
    message,
    type = "success"
) {

    let toast =
        document.getElementById(
            "adminToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "adminToast";

        document.body.appendChild(
            toast
        );
    }


    toast.className =
        `admin-toast ${type}`;


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 3000);
}


function formatMoney(value) {

    return Number(
        value || 0
    ).toLocaleString(
        "en-UG",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );
}


function formatDate(value) {

    if (!value) {
        return "N/A";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "N/A";
    }


    return date.toLocaleDateString(
        "en-UG",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// =====================================================
// START PAGE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
         * IMPORTANT:
         * Do not load deposit information
         * until administrator authorization
         * has succeeded.
         */

        const authorized =
            await verifyAdminAccess();


        if (!authorized) {
            return;
        }


        setupEventHandlers();

        await loadDeposits();
    }
);