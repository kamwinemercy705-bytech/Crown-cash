"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_CHECK_URL =
    `${API_BASE}/admin-check.php`;

const USERS_API_URL =
    `${API_BASE}/users.php`;


// =====================================================
// REDIRECT UNAUTHORIZED USERS
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
            "Admin authentication check failed:",
            error
        );

        window.location.replace(
            "/login.html?admin=login_required"
        );

        return false;
    }
}


// =====================================================
// GLOBAL STATE
// =====================================================

let allUsers = [];


// =====================================================
// LOAD USERS
// =====================================================

async function loadUsers() {

    try {

        showLoading();

        const response = await fetch(
            USERS_API_URL,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (response.status === 401 ||
            response.status === 403) {

            window.location.replace(
                "/login.html?admin=login_required"
            );

            return;
        }

        const data = await response.json();

        if (!response.ok || data.success !== true) {

            throw new Error(
                data.message ||
                "Unable to load users."
            );
        }

        allUsers = Array.isArray(data.users)
            ? data.users
            : [];

        renderStatistics(data.stats || {});
        renderUsers();

    } catch (error) {

        console.error(
            "Users loading error:",
            error
        );

        showError(
            error.message ||
            "Unable to load users."
        );
    }
}


// =====================================================
// RENDER STATISTICS
// =====================================================

function renderStatistics(stats) {

    const totalUsers =
        document.getElementById("totalUsers");

    const activeUsers =
        document.getElementById("activeUsers");

    const blockedUsers =
        document.getElementById("blockedUsers");

    const adminUsers =
        document.getElementById("adminUsers");


    if (totalUsers) {

        totalUsers.textContent =
            Number(stats.total || 0)
                .toLocaleString();
    }


    if (activeUsers) {

        activeUsers.textContent =
            Number(stats.active || 0)
                .toLocaleString();
    }


    if (blockedUsers) {

        blockedUsers.textContent =
            Number(
                stats.blocked ||
                stats.suspended ||
                0
            ).toLocaleString();
    }


    if (adminUsers) {

        adminUsers.textContent =
            Number(stats.admins || 0)
                .toLocaleString();
    }
}


// =====================================================
// RENDER USERS
// =====================================================

function renderUsers() {

    const tableBody =
        document.getElementById("usersTableBody");

    if (!tableBody) {
        return;
    }


    const searchInput =
        document.getElementById("searchUsers");

    const statusFilter =
        document.getElementById("statusFilter");

    const roleFilter =
        document.getElementById("roleFilter");


    const search =
        (searchInput?.value || "")
            .trim()
            .toLowerCase();


    const status =
        statusFilter?.value || "all";


    const role =
        roleFilter?.value || "all";


    const filteredUsers =
        allUsers.filter(user => {

            const searchableText = [

                user.full_name,
                user.email,
                user.phone,
                user.referral_code

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                search &&
                !searchableText.includes(search)
            ) {
                return false;
            }


            if (
                status !== "all" &&
                String(user.status || "")
                    .toLowerCase() !== status.toLowerCase()
            ) {
                return false;
            }


            const userRole =
                String(
                    user.role ||
                    user.account_type ||
                    "user"
                ).toLowerCase();


            if (
                role !== "all" &&
                userRole !== role.toLowerCase()
            ) {
                return false;
            }


            return true;
        });


    if (!filteredUsers.length) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No users found.
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        filteredUsers.map(user => {

            const id =
                escapeHtml(
                    String(user.id || user._id || "")
                );


            const name =
                escapeHtml(
                    String(
                        user.full_name ||
                        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                        "Unknown User"
                    )
                );


            const email =
                escapeHtml(
                    String(user.email || "")
                );


            const phone =
                escapeHtml(
                    String(user.phone || "")
                );


            const statusValue =
                String(
                    user.status ||
                    "active"
                ).toLowerCase();


            const roleValue =
                String(
                    user.role ||
                    user.account_type ||
                    "user"
                ).toLowerCase();


            return `
                <tr>

                    <td>
                        ${name}
                    </td>

                    <td>
                        ${email}
                    </td>

                    <td>
                        ${phone}
                    </td>

                    <td>
                        <span class="status-badge ${escapeHtml(statusValue)}">
                            ${escapeHtml(statusValue)}
                        </span>
                    </td>

                    <td>
                        <span class="role-badge ${escapeHtml(roleValue)}">
                            ${escapeHtml(roleValue)}
                        </span>
                    </td>

                    <td>
                        UGX ${formatMoney(user.balance)}
                    </td>

                    <td>
                        ${formatDate(user.created_at)}
                    </td>

                    <td>

                        <div class="user-actions">

                            <button
                                type="button"
                                class="action-btn view-btn"
                                data-action="view"
                                data-id="${id}"
                            >
                                View
                            </button>

                            ${
                                statusValue === "active"
                                ? `
                                    <button
                                        type="button"
                                        class="action-btn danger-btn"
                                        data-action="block"
                                        data-id="${id}"
                                    >
                                        Block
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="action-btn success-btn"
                                        data-action="activate"
                                        data-id="${id}"
                                    >
                                        Activate
                                    </button>
                                `
                            }

                        </div>

                    </td>

                </tr>
            `;

        }).join("");
}


// =====================================================
// VIEW USER
// =====================================================

function viewUser(userId) {

    const user =
        allUsers.find(
            item =>
                String(item.id || item._id) ===
                String(userId)
        );


    if (!user) {

        showToast(
            "User information was not found.",
            "error"
        );

        return;
    }


    const message = [

        `Name: ${user.full_name || "N/A"}`,
        `Email: ${user.email || "N/A"}`,
        `Phone: ${user.phone || "N/A"}`,
        `Status: ${user.status || "N/A"}`,
        `Role: ${user.role || user.account_type || "user"}`,
        `Balance: UGX ${formatMoney(user.balance)}`,
        `Referral Code: ${user.referral_code || "N/A"}`,
        `Created: ${formatDate(user.created_at)}`

    ].join("\n");


    alert(message);
}


// =====================================================
// CHANGE USER STATUS
// =====================================================

async function changeUserStatus(
    userId,
    action
) {

    const actionText =
        action === "block"
            ? "block"
            : "activate";


    const confirmed =
        confirm(
            `Are you sure you want to ${actionText} this user?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response = await fetch(
            USERS_API_URL,
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
                        action === "block"
                            ? "block"
                            : "activate",

                    user_id:
                        userId
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
                "Unable to update user."
            );
        }


        showToast(
            data.message ||
            "User updated successfully.",
            "success"
        );


        await loadUsers();

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to update user.",
            "error"
        );
    }
}


// =====================================================
// EVENT HANDLERS
// =====================================================

function setupEventHandlers() {

    const searchInput =
        document.getElementById("searchUsers");

    const statusFilter =
        document.getElementById("statusFilter");

    const roleFilter =
        document.getElementById("roleFilter");

    const refreshButton =
        document.getElementById("refreshUsers");

    const logoutButton =
        document.getElementById("logoutBtn");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderUsers
        );
    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderUsers
        );
    }


    if (roleFilter) {

        roleFilter.addEventListener(
            "change",
            renderUsers
        );
    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            loadUsers
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

            const userId =
                button.dataset.id;


            if (action === "view") {

                viewUser(userId);

            } else if (
                action === "block" ||
                action === "activate"
            ) {

                changeUserStatus(
                    userId,
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
        document.getElementById("usersTableBody");

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="loading-state">
                Loading users...
            </td>
        </tr>
    `;
}


function showError(message) {

    const tableBody =
        document.getElementById("usersTableBody");

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="error-state">
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
        document.getElementById("adminToast");


    if (!toast) {

        toast =
            document.createElement("div");

        toast.id =
            "adminToast";

        document.body.appendChild(toast);
    }


    toast.className =
        `admin-toast ${type}`;


    toast.textContent =
        message;


    toast.classList.add("show");


    setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);
}


function formatMoney(value) {

    const number =
        Number(value || 0);


    return number.toLocaleString(
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


    if (Number.isNaN(date.getTime())) {
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

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =====================================================
// START ADMIN PAGE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
         * Do NOT load any user data until
         * administrator authorization succeeds.
         */

        const authorized =
            await verifyAdminAccess();


        if (!authorized) {
            return;
        }


        setupEventHandlers();

        await loadUsers();
    }
);