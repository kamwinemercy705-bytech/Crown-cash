"use strict";

/*
=========================================================
CROWN CASH ADMIN — USER MANAGEMENT
=========================================================
*/

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const USERS_API =
    `${API_BASE}/admin-users.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;

const PAGE_SIZE = 10;


/* =========================================================
   STATE
========================================================= */

const state = {
    users: [],
    filteredUsers: [],
    currentPage: 1,
    selectedUser: null,
    loading: false
};


/* =========================================================
   DOM
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   ELEMENTS
========================================================= */

const sidebar =
    $("sidebar");

const sidebarOverlay =
    $("sidebarOverlay");

const menuButton =
    $("menuButton");

const sidebarClose =
    $("sidebarClose");

const logoutBtn =
    $("logoutBtn");

const adminName =
    $("adminName");

const adminAvatar =
    $("adminAvatar");

const adminAccountType =
    $("adminAccountType");

const headerUserName =
    $("headerUserName");

const accountAvatar =
    $("accountAvatar");

const totalUsers =
    $("totalUsers");

const activeUsers =
    $("activeUsers");

const blockedUsers =
    $("blockedUsers");

const adminUsers =
    $("adminUsers");

const searchUsers =
    $("searchUsers");

const statusFilter =
    $("statusFilter");

const accountTypeFilter =
    $("accountTypeFilter");

const refreshUsersBtn =
    $("refreshUsersBtn");

const usersMessage =
    $("usersMessage");

const usersTableBody =
    $("usersTableBody");

const pagination =
    $("pagination");

const usersCountBadge =
    $("usersCountBadge");

const userModal =
    $("userModal");

const closeUserModal =
    $("closeUserModal");

const modalUserAvatar =
    $("modalUserAvatar");

const modalUserName =
    $("modalUserName");

const modalUserEmail =
    $("modalUserEmail");

const modalUserPhone =
    $("modalUserPhone");

const modalReferralCode =
    $("modalReferralCode");

const modalUserBalance =
    $("modalUserBalance");

const modalUserStatus =
    $("modalUserStatus");

const modalAccountType =
    $("modalAccountType");

const modalCreatedAt =
    $("modalCreatedAt");

const manageUserBtn =
    $("manageUserBtn");


/* =========================================================
   SAFE JSON FETCH
========================================================= */

async function fetchJSON(
    url,
    options = {},
    timeout = 15000
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        const response =
            await fetch(url, {
                credentials: "include",
                cache: "no-store",
                ...options,
                signal: controller.signal
            });

        const text =
            await response.text();

        let data = {};

        try {
            data = text
                ? JSON.parse(text)
                : {};
        } catch (error) {

            throw new Error(
                `Server returned invalid JSON (${response.status}).`
            );
        }

        if (!response.ok) {

            const message =
                data.message ||
                `Request failed with status ${response.status}.`;

            const error =
                new Error(message);

            error.status =
                response.status;

            throw error;
        }

        return data;

    } catch (error) {

        if (
            error.name === "AbortError"
        ) {
            throw new Error(
                "The server took too long to respond."
            );
        }

        throw error;

    } finally {

        clearTimeout(timer);
    }
}


/* =========================================================
   SHOW MESSAGE
========================================================= */

function showMessage(
    message,
    type = "info"
) {

    if (!usersMessage) {
        return;
    }

    usersMessage.textContent =
        message;

    usersMessage.className =
        `users-message show ${type}`;

}


/* =========================================================
   HIDE MESSAGE
========================================================= */

function hideMessage() {

    if (!usersMessage) {
        return;
    }

    usersMessage.textContent = "";

    usersMessage.className =
        "users-message";
}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

async function verifyAdmin() {

    const data =
        await fetchJSON(
            ADMIN_AUTH_API,
            {
                method: "GET"
            },
            12000
        );

    if (
        !data ||
        data.success !== true ||
        data.authorized !== true
    ) {

        const error =
            new Error(
                data?.message ||
                "Administrator access is required."
            );

        error.status =
            403;

        throw error;
    }

    return data;
}


/* =========================================================
   LOAD ADMIN PROFILE
========================================================= */

async function loadAdminProfile() {

    try {

        const data =
            await fetchJSON(
                PROFILE_API,
                {
                    method: "GET"
                },
                12000
            );

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
            fullName.split(/\s+/)[0] ||
            "Administrator";

        const accountType =
            user.account_type ||
            user.role ||
            "admin";

        if (adminName) {
            adminName.textContent =
                fullName;
        }

        if (headerUserName) {
            headerUserName.textContent =
                firstName;
        }

        if (adminAccountType) {
            adminAccountType.textContent =
                accountType === "admin" ||
                accountType === "administrator"
                    ? "Admin Account"
                    : accountType;
        }

        const avatar =
            firstName
                .charAt(0)
                .toUpperCase();

        if (adminAvatar) {
            adminAvatar.textContent =
                avatar || "A";
        }

        if (accountAvatar) {
            accountAvatar.textContent =
                avatar || "A";
        }

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );
    }
}


/* =========================================================
   NORMALIZE NUMBER
========================================================= */

function numberValue(value) {

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
            value.$numberDecimal !== undefined
        ) {
            return Number(
                value.$numberDecimal
            ) || 0;
        }

        if (
            value.$numberInt !== undefined
        ) {
            return Number(
                value.$numberInt
            ) || 0;
        }

        if (
            value.$numberLong !== undefined
        ) {
            return Number(
                value.$numberLong
            ) || 0;
        }

        if (
            value.value !== undefined
        ) {
            return Number(
                value.value
            ) || 0;
        }
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    let date;

    try {

        if (
            typeof value === "object" &&
            value.$date
        ) {

            if (
                typeof value.$date === "object" &&
                value.$date.$numberLong
            ) {
                date =
                    new Date(
                        Number(
                            value.$date.$numberLong
                        )
                    );
            } else {
                date =
                    new Date(
                        value.$date
                    );
            }

        } else if (
            typeof value === "object" &&
            value.$numberLong
        ) {

            date =
                new Date(
                    Number(
                        value.$numberLong
                    )
                );

        } else {

            date =
                new Date(value);
        }

    } catch (error) {

        return "—";
    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-UG",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(value) {

    const amount =
        numberValue(value);

    return (
        "UGX " +
        amount.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        )
    );
}


/* =========================================================
   USER ID
========================================================= */

function getUserId(user) {

    if (!user) {
        return "";
    }

    if (
        typeof user.id === "string"
    ) {
        return user.id;
    }

    if (
        typeof user._id === "string"
    ) {
        return user._id;
    }

    if (
        user._id &&
        typeof user._id === "object"
    ) {

        if (
            user._id.$oid
        ) {
            return user._id.$oid;
        }

        if (
            user._id.$numberLong
        ) {
            return user._id.$numberLong;
        }
    }

    return "";
}


/* =========================================================
   USER NAME
========================================================= */

function getUserName(user) {

    if (!user) {
        return "Unknown User";
    }

    if (
        user.full_name
    ) {
        return String(
            user.full_name
        ).trim();
    }

    const fullName =
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ")
            .trim();

    return fullName ||
        user.email ||
        "Unknown User";
}


/* =========================================================
   USER INITIALS
========================================================= */

function getInitials(name) {

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (!parts.length) {
        return "U";
    }

    if (parts.length === 1) {
        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}


/* =========================================================
   NORMALIZE USER
========================================================= */

function normalizeUser(user) {

    const name =
        getUserName(user);

    return {

        ...user,

        id:
            getUserId(user),

        full_name:
            name,

        email:
            String(
                user.email ||
                ""
            ),

        phone:
            String(
                user.phone ||
                user.phone_number ||
                user.mobile ||
                ""
            ),

        referral_code:
            String(
                user.referral_code ||
                ""
            ),

        balance:
            numberValue(
                user.balance ??
                user.wallet_balance ??
                0
            ),

        status:
            String(
                user.status ||
                "active"
            ).toLowerCase(),

        account_type:
            String(
                user.account_type ||
                user.role ||
                "user"
            ).toLowerCase(),

        created_at:
            user.created_at ||
            user.createdAt ||
            null
    };
}


/* =========================================================
   LOAD USERS
========================================================= */

async function loadUsers() {

    if (state.loading) {
        return;
    }

    state.loading =
        true;

    if (refreshUsersBtn) {

        refreshUsersBtn.classList.add(
            "loading"
        );

        refreshUsersBtn.disabled =
            true;
    }

    renderLoading();

    hideMessage();

    try {

        const data =
            await fetchJSON(
                USERS_API,
                {
                    method: "GET"
                },
                15000
            );

        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load users."
            );
        }

        const rawUsers =
            Array.isArray(
                data.users
            )
                ? data.users
                : [];

        state.users =
            rawUsers.map(
                normalizeUser
            );

        state.currentPage =
            1;

        updateStatistics(
            data
        );

        applyFilters();

        hideMessage();

    } catch (error) {

        console.error(
            "User loading error:",
            error
        );

        state.users = [];
        state.filteredUsers = [];

        updateStatistics({
            total_users: 0,
            active_users: 0,
            blocked_users: 0,
            admin_users: 0
        });

        renderUsers();

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            showMessage(
                "Administrator authorization failed. Please log in again.",
                "error"
            );

            setTimeout(
                () => {
                    window.location.href =
                        "login.html";
                },
                1800
            );

        } else {

            showMessage(
                error.message ||
                "Unable to load users. Please try again.",
                "error"
            );
        }

    } finally {

        state.loading =
            false;

        if (refreshUsersBtn) {

            refreshUsersBtn.classList.remove(
                "loading"
            );

            refreshUsersBtn.disabled =
                false;
        }
    }
}


/* =========================================================
   UPDATE STATISTICS
========================================================= */

function updateStatistics(data) {

    const users =
        state.users;

    const total =
        data.total_users !== undefined
            ? numberValue(
                data.total_users
            )
            : users.length;

    const active =
        data.active_users !== undefined
            ? numberValue(
                data.active_users
            )
            : users.filter(
                user =>
                    user.status === "active"
            ).length;

    const blocked =
        data.blocked_users !== undefined
            ? numberValue(
                data.blocked_users
            )
            : users.filter(
                user =>
                    user.status === "blocked"
            ).length;

    const admins =
        data.admin_users !== undefined
            ? numberValue(
                data.admin_users
            )
            : users.filter(
                user =>
                    user.account_type === "admin" ||
                    user.account_type === "administrator"
            ).length;

    if (totalUsers) {
        totalUsers.textContent =
            total.toLocaleString();
    }

    if (activeUsers) {
        activeUsers.textContent =
            active.toLocaleString();
    }

    if (blockedUsers) {
        blockedUsers.textContent =
            blocked.toLocaleString();
    }

    if (adminUsers) {
        adminUsers.textContent =
            admins.toLocaleString();
    }
}


/* =========================================================
   APPLY FILTERS
========================================================= */

function applyFilters() {

    const search =
        String(
            searchUsers?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const status =
        String(
            statusFilter?.value ||
            "all"
        ).toLowerCase();

    const accountType =
        String(
            accountTypeFilter?.value ||
            "all"
        ).toLowerCase();

    state.filteredUsers =
        state.users.filter(
            user => {

                const searchable =
                    [
                        user.full_name,
                        user.email,
                        user.phone,
                        user.referral_code,
                        user.id
                    ]
                        .join(" ")
                        .toLowerCase();

                const searchMatches =
                    !search ||
                    searchable.includes(
                        search
                    );

                const statusMatches =
                    status === "all" ||
                    user.status === status;

                const accountMatches =
                    accountType === "all" ||
                    user.account_type === accountType;

                return (
                    searchMatches &&
                    statusMatches &&
                    accountMatches
                );
            }
        );

    state.currentPage =
        1;

    renderUsers();
}


/* =========================================================
   LOADING ROW
========================================================= */

function renderLoading() {

    if (!usersTableBody) {
        return;
    }

    usersTableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="users-loading-row"
            >
                <div class="users-loading-spinner"></div>
                Loading users...
            </td>
        </tr>
    `;

    if (pagination) {
        pagination.innerHTML = "";
    }
}


/* =========================================================
   RENDER USERS
========================================================= */

function renderUsers() {

    if (!usersTableBody) {
        return;
    }

    const total =
        state.filteredUsers.length;

    if (usersCountBadge) {

        usersCountBadge.textContent =
            `${total.toLocaleString()} ${
                total === 1
                    ? "user"
                    : "users"
            }`;
    }

    if (!total) {

        usersTableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="users-empty-row"
                >
                    No users found.
                </td>
            </tr>
        `;

        renderPagination();

        return;
    }

    const start =
        (state.currentPage - 1) *
        PAGE_SIZE;

    const end =
        start + PAGE_SIZE;

    const pageUsers =
        state.filteredUsers.slice(
            start,
            end
        );

    usersTableBody.innerHTML =
        pageUsers
            .map(
                user =>
                    renderUserRow(user)
            )
            .join("");

    renderPagination();
}


/* =========================================================
   RENDER USER ROW
========================================================= */

function renderUserRow(user) {

    const name =
        getUserName(user);

    const initials =
        getInitials(name);

    const status =
        user.status ||
        "active";

    const statusClass =
        [
            "active",
            "pending",
            "suspended",
            "blocked",
            "disabled"
        ].includes(status)
            ? `status-${status}`
            : "status-pending";

    const account =
        user.account_type ||
        "user";

    const accountLabel =
        account === "administrator"
            ? "Admin"
            : account.charAt(0).toUpperCase() +
              account.slice(1);

    const safeId =
        escapeHTML(
            String(
                user.id || ""
            )
        );

    return `
        <tr>

            <td>
                <div class="user-cell">

                    <div class="user-avatar">
                        ${escapeHTML(initials)}
                    </div>

                    <div>
                        <div class="user-name">
                            ${escapeHTML(name)}
                        </div>

                        <div class="user-email">
                            ${escapeHTML(
                                user.email || "No email"
                            )}
                        </div>
                    </div>

                </div>
            </td>

            <td>
                ${escapeHTML(
                    user.phone || "—"
                )}
            </td>

            <td>
                <span class="balance-value">
                    ${formatCurrency(
                        user.balance
                    )}
                </span>
            </td>

            <td>
                <span
                    class="status-pill ${statusClass}"
                >
                    ${escapeHTML(status)}
                </span>
            </td>

            <td>
                <span class="account-pill">
                    ${escapeHTML(
                        accountLabel
                    )}
                </span>
            </td>

            <td>
                ${formatDate(
                    user.created_at
                )}
            </td>

            <td>

                <button
                    type="button"
                    class="view-user-btn"
                    data-user-id="${safeId}"
                    aria-label="View user"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linejoin="round"
                        />

                        <circle
                            cx="12"
                            cy="12"
                            r="2.7"
                            stroke="currentColor"
                            stroke-width="1.7"
                        />
                    </svg>

                </button>

            </td>

        </tr>
    `;
}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination() {

    if (!pagination) {
        return;
    }

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                state.filteredUsers.length /
                PAGE_SIZE
            )
        );

    if (
        state.filteredUsers.length <=
        PAGE_SIZE
    ) {

        pagination.innerHTML = "";
        return;
    }

    const start =
        (state.currentPage - 1) *
        PAGE_SIZE + 1;

    const end =
        Math.min(
            state.currentPage * PAGE_SIZE,
            state.filteredUsers.length
        );

    let buttons = "";

    buttons += `
        <button
            type="button"
            class="pagination-btn"
            data-page="${state.currentPage - 1}"
            ${state.currentPage === 1 ? "disabled" : ""}
        >
            ‹
        </button>
    `;

    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        if (
            totalPages > 7 &&
            page > 3 &&
            page < totalPages - 2 &&
            Math.abs(
                page - state.currentPage
            ) > 1
        ) {

            if (
                page === 4 ||
                page === totalPages - 3
            ) {

                buttons += `
                    <span
                        style="
                            padding: 0 4px;
                            color: rgba(255,255,255,.35);
                            align-self:center;
                        "
                    >
                        …
                    </span>
                `;
            }

            continue;
        }

        buttons += `
            <button
                type="button"
                class="pagination-btn ${
                    page === state.currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>
        `;
    }

    buttons += `
        <button
            type="button"
            class="pagination-btn"
            data-page="${state.currentPage + 1}"
            ${
                state.currentPage === totalPages
                    ? "disabled"
                    : ""
            }
        >
            ›
        </button>
    `;

    pagination.innerHTML = `

        <div class="pagination-info">
            Showing ${start}–${end}
            of ${state.filteredUsers.length}
        </div>

        <div class="pagination-buttons">
            ${buttons}
        </div>
    `;
}


/* =========================================================
   OPEN USER MODAL
========================================================= */

function openUserModal(user) {

    if (!userModal) {
        return;
    }

    state.selectedUser =
        user;

    const name =
        getUserName(user);

    if (modalUserAvatar) {
        modalUserAvatar.textContent =
            getInitials(name);
    }

    if (modalUserName) {
        modalUserName.textContent =
            name;
    }

    if (modalUserEmail) {
        modalUserEmail.textContent =
            user.email || "No email";
    }

    if (modalUserPhone) {
        modalUserPhone.textContent =
            user.phone || "—";
    }

    if (modalReferralCode) {
        modalReferralCode.textContent =
            user.referral_code || "—";
    }

    if (modalUserBalance) {
        modalUserBalance.textContent =
            formatCurrency(
                user.balance
            );
    }

    if (modalUserStatus) {
        modalUserStatus.textContent =
            user.status || "—";
    }

    if (modalAccountType) {
        modalAccountType.textContent =
            user.account_type || "user";
    }

    if (modalCreatedAt) {
        modalCreatedAt.textContent =
            formatDate(
                user.created_at
            );
    }

    userModal.classList.add(
        "show"
    );

    userModal.setAttribute(
        "aria-hidden",
        "false"
    );
}


/* =========================================================
   CLOSE USER MODAL
========================================================= */

function closeModal() {

    if (!userModal) {
        return;
    }

    userModal.classList.remove(
        "show"
    );

    userModal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   FIND USER
========================================================= */

function findUserById(id) {

    return state.users.find(
        user =>
            String(
                user.id
            ) === String(id)
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {

    if (sidebar) {
        sidebar.classList.add(
            "open"
        );
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.add(
            "show"
        );
    }

    document.body.classList.add(
        "sidebar-open"
    );
}


function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove(
            "open"
        );
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove(
            "show"
        );
    }

    document.body.classList.remove(
        "sidebar-open"
    );
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    if (logoutBtn) {
        logoutBtn.disabled = true;
    }

    try {

        await fetchJSON(
            LOGOUT_API,
            {
                method: "POST"
            },
            10000
        );

    } catch (error) {

        console.warn(
            "Logout request:",
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

function attachEvents() {

    if (menuButton) {
        menuButton.addEventListener(
            "click",
            openSidebar
        );
    }

    if (sidebarClose) {
        sidebarClose.addEventListener(
            "click",
            closeSidebar
        );
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );
    }

    if (logoutBtn) {
        logoutBtn.addEventListener(
            "click",
            logout
        );
    }

    if (refreshUsersBtn) {

        refreshUsersBtn.addEventListener(
            "click",
            loadUsers
        );
    }

    if (searchUsers) {

        searchUsers.addEventListener(
            "input",
            applyFilters
        );
    }

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );
    }

    if (accountTypeFilter) {

        accountTypeFilter.addEventListener(
            "change",
            applyFilters
        );
    }

    if (usersTableBody) {

        usersTableBody.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-user-id]"
                    );

                if (!button) {
                    return;
                }

                const id =
                    button.dataset.userId;

                const user =
                    findUserById(id);

                if (user) {
                    openUserModal(
                        user
                    );
                }
            }
        );
    }

    if (pagination) {

        pagination.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-page]"
                    );

                if (
                    !button ||
                    button.disabled
                ) {
                    return;
                }

                const page =
                    Number(
                        button.dataset.page
                    );

                if (
                    !Number.isFinite(page)
                ) {
                    return;
                }

                const totalPages =
                    Math.ceil(
                        state.filteredUsers.length /
                        PAGE_SIZE
                    );

                if (
                    page < 1 ||
                    page > totalPages
                ) {
                    return;
                }

                state.currentPage =
                    page;

                renderUsers();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );
    }

    if (closeUserModal) {

        closeUserModal.addEventListener(
            "click",
            closeModal
        );
    }

    if (userModal) {

        userModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    userModal
                ) {
                    closeModal();
                }
            }
        );
    }

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {
                closeModal();
                closeSidebar();
            }
        }
    );

    /*
    ---------------------------------------------------------
    Manage Account button
    ---------------------------------------------------------
    */

    if (manageUserBtn) {

        manageUserBtn.addEventListener(
            "click",
            () => {

                if (
                    !state.selectedUser
                ) {
                    return;
                }

                /*
                admin-user-actions.js can use
                this event to open its management
                controls.
                */

                window.dispatchEvent(
                    new CustomEvent(
                        "crowncash:manage-user",
                        {
                            detail: {
                                user:
                                    state.selectedUser
                            }
                        }
                    )
                );
            }
        );
    }
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializePage() {

    /*
    IMPORTANT:
    There is intentionally NO full-screen loader here.
    The page itself must remain visible.
    */

    attachEvents();

    /*
    Show the page immediately.
    */

    try {

        await verifyAdmin();

    } catch (error) {

        console.error(
            "Admin authentication failed:",
            error
        );

        showMessage(
            error.message ||
            "Administrator authorization failed.",
            "error"
        );

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            setTimeout(
                () => {
                    window.location.href =
                        "login.html";
                },
                1800
            );
        }

        return;
    }

    /*
    Load profile and users independently.
    If profile fails, users can still load.
    */

    await Promise.allSettled([
        loadAdminProfile(),
        loadUsers()
    ]);
}


/* =========================================================
   GLOBAL ADMIN USERS OBJECT
========================================================= */

window.CrownCashAdminUsers = {

    loadUsers,

    getUsers: () =>
        state.users,

    getFilteredUsers: () =>
        state.filteredUsers,

    getSelectedUser: () =>
        state.selectedUser,

    refresh: loadUsers,

    showMessage,

    openUserModal,

    closeModal
};


/* =========================================================
   START
========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializePage
    );

} else {

    initializePage();
}