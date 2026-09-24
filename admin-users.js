"use strict";

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin User Management
|--------------------------------------------------------------------------
| Handles:
| - Administrator authentication
| - Admin profile
| - User loading
| - Search
| - Status filtering
| - Account-type filtering
| - Pagination
| - User details modal
| - Logout
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const PROFILE_API = `${API_BASE}/profile.php`;
const USERS_API = `${API_BASE}/admin-users.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;


/* =========================================================
   STATE
========================================================= */

const state = {
    users: [],
    filteredUsers: [],
    currentPage: 1,
    perPage: 10,
    selectedUser: null,
    loading: false
};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function showElement(element) {
    if (!element) return;

    element.hidden = false;
}


function hideElement(element) {
    if (!element) return;

    element.hidden = true;
}


/* =========================================================
   PAGE LOADER
========================================================= */

function hidePageLoader() {

    const loader = $("pageLoader");

    if (!loader) return;

    setTimeout(() => {
        loader.classList.add("hidden");

        setTimeout(() => {
            loader.style.display = "none";
        }, 300);

    }, 300);
}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(message, type = "error") {

    const box = $("usersMessage");

    if (!box) return;

    box.textContent = message;
    box.className = `admin-message ${type}`;

    box.hidden = false;
}


function hideMessage() {

    const box = $("usersMessage");

    if (!box) return;

    box.hidden = true;
    box.textContent = "";
}


/* =========================================================
   AUTHENTICATION
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
                },
                cache: "no-store"
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
            data.authorized !== true
        ) {

            window.location.href = "login.html";
            return false;
        }

        return true;

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        window.location.href = "login.html";

        return false;
    }
}


/* =========================================================
   PROFILE
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
                },
                cache: "no-store"
            }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (
            !data ||
            data.success !== true ||
            !data.user
        ) {
            return;
        }

        const user = data.user;

        const firstName =
            user.first_name ||
            "";

        const fullName =
            user.full_name ||
            `${firstName} ${user.last_name || ""}`.trim() ||
            "Administrator";

        const accountType =
            user.account_type ||
            "admin";

        if ($("adminName")) {
            $("adminName").textContent = fullName;
        }

        if ($("headerUserName")) {
            $("headerUserName").textContent =
                firstName ||
                fullName ||
                "Administrator";
        }

        if ($("adminAccountType")) {
            $("adminAccountType").textContent =
                formatAccountType(accountType);
        }

    } catch (error) {

        console.error(
            "Unable to load admin profile:",
            error
        );
    }
}


/* =========================================================
   LOAD USERS
========================================================= */

async function loadUsers() {

    if (state.loading) return;

    state.loading = true;

    showLoadingState();
    hideMessage();

    try {

        const response = await fetch(
            USERS_API,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store"
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
            response.status === 403
        ) {

            window.location.href = "login.html";
            return;
        }

        if (
            !response.ok ||
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load users."
            );
        }

        const users =
            Array.isArray(data.users)
                ? data.users
                : [];

        state.users = users;

        updateStatistics(data, users);

        applyFilters();

    } catch (error) {

        console.error(
            "User loading error:",
            error
        );

        state.users = [];
        state.filteredUsers = [];

        renderUsers();

        showMessage(
            error.message ||
            "Unable to load users. Please try again.",
            "error"
        );

    } finally {

        state.loading = false;

        hideLoadingState();
    }
}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics(data, users) {

    let total =
        Number(data?.stats?.total_users);

    let active =
        Number(data?.stats?.active_users);

    let blocked =
        Number(data?.stats?.blocked_users);

    let admins =
        Number(data?.stats?.admin_users);


    if (!Number.isFinite(total)) {
        total = users.length;
    }


    if (!Number.isFinite(active)) {

        active = users.filter(
            user =>
                normalizeStatus(
                    user.status
                ) === "active"
        ).length;
    }


    if (!Number.isFinite(blocked)) {

        blocked = users.filter(
            user => {

                const status =
                    normalizeStatus(
                        user.status
                    );

                return [
                    "blocked",
                    "suspended",
                    "disabled",
                    "banned"
                ].includes(status);
            }
        ).length;
    }


    if (!Number.isFinite(admins)) {

        admins = users.filter(
            user => {

                const role =
                    String(
                        user.role ||
                        ""
                    ).toLowerCase();

                const accountType =
                    String(
                        user.account_type ||
                        user.accountType ||
                        ""
                    ).toLowerCase();

                return (
                    role === "admin" ||
                    accountType === "admin" ||
                    accountType === "administrator"
                );
            }
        ).length;
    }


    setText(
        "totalUsers",
        formatNumber(total)
    );

    setText(
        "activeUsers",
        formatNumber(active)
    );

    setText(
        "blockedUsers",
        formatNumber(blocked)
    );

    setText(
        "adminUsers",
        formatNumber(admins)
    );
}


/* =========================================================
   FILTERING
========================================================= */

function applyFilters() {

    const searchInput =
        $("searchUsers");

    const statusSelect =
        $("statusFilter");

    const accountTypeSelect =
        $("accountTypeFilter");


    const search =
        String(
            searchInput?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const status =
        String(
            statusSelect?.value ||
            "all"
        )
        .toLowerCase();


    const accountType =
        String(
            accountTypeSelect?.value ||
            "all"
        )
        .toLowerCase();


    state.filteredUsers =
        state.users.filter(user => {

            /* -------------------------
               Search
            ------------------------- */

            if (search) {

                const searchableText = [

                    user.full_name,

                    user.fullName,

                    user.first_name,

                    user.firstName,

                    user.last_name,

                    user.lastName,

                    user.email,

                    user.phone,

                    user.phone_number,

                    user.mobile,

                    user.referral_code,

                    user.referralCode,

                    user._id,

                    user.id

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                if (
                    !searchableText.includes(search)
                ) {
                    return false;
                }
            }


            /* -------------------------
               Status
            ------------------------- */

            if (status !== "all") {

                const userStatus =
                    normalizeStatus(
                        user.status
                    );

                if (
                    userStatus !== status
                ) {
                    return false;
                }
            }


            /* -------------------------
               Account Type
            ------------------------- */

            if (
                accountType !== "all"
            ) {

                const userAccountType =
                    getAccountType(user);


                if (
                    userAccountType !==
                    accountType
                ) {
                    return false;
                }
            }


            return true;
        });


    state.currentPage = 1;

    renderUsers();
}


/* =========================================================
   RENDER USERS
========================================================= */

function renderUsers() {

    const tbody =
        $("usersTableBody");

    const emptyState =
        $("usersEmpty");

    if (!tbody) return;


    tbody.innerHTML = "";


    if (
        !state.filteredUsers.length
    ) {

        if (emptyState) {
            showElement(emptyState);
        }

        renderPagination();

        return;
    }


    if (emptyState) {
        hideElement(emptyState);
    }


    const start =
        (state.currentPage - 1) *
        state.perPage;


    const end =
        start +
        state.perPage;


    const pageUsers =
        state.filteredUsers.slice(
            start,
            end
        );


    pageUsers.forEach(
        user => {

            tbody.appendChild(
                createUserRow(user)
            );
        }
    );


    renderPagination();
}


/* =========================================================
   USER ROW
========================================================= */

function createUserRow(user) {

    const row =
        document.createElement("tr");


    const fullName =
        getUserName(user);


    const email =
        String(
            user.email ||
            ""
        );


    const phone =
        getUserPhone(user);


    const balance =
        getUserBalance(user);


    const status =
        normalizeStatus(
            user.status ||
            "active"
        );


    const accountType =
        getAccountType(user);


    const createdAt =
        getUserCreatedAt(user);


    row.innerHTML = `

        <td>

            <div class="user-table-profile">

                <div class="table-avatar">

                    ${getUserIcon()}

                </div>

                <div class="table-user-info">

                    <strong>
                        ${escapeHTML(fullName)}
                    </strong>

                    <span>
                        ${escapeHTML(email || "No email")}
                    </span>

                </div>

            </div>

        </td>


        <td>
            <span class="table-secondary">
                ${escapeHTML(phone || "—")}
            </span>
        </td>


        <td>

            <strong class="balance-value">
                ${formatCurrency(balance)}
            </strong>

        </td>


        <td>

            <span class="status-badge ${getStatusClass(status)}">
                ${escapeHTML(
                    formatStatus(status)
                )}
            </span>

        </td>


        <td>

            <span class="account-type-badge">
                ${escapeHTML(
                    formatAccountType(
                        accountType
                    )
                )}
            </span>

        </td>


        <td>

            <span class="table-secondary">
                ${escapeHTML(
                    formatDate(createdAt)
                )}
            </span>

        </td>


        <td>

            <div class="table-actions">

                <button
                    type="button"
                    class="icon-button"
                    title="View user"
                    aria-label="View user"
                    data-action="view"
                    data-user-id="${escapeHTML(
                        getUserId(user)
                    )}"
                >

                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
                        <circle cx="12" cy="12" r="2.5"></circle>
                    </svg>

                </button>


                <button
                    type="button"
                    class="icon-button"
                    title="Manage user"
                    aria-label="Manage user"
                    data-action="manage"
                    data-user-id="${escapeHTML(
                        getUserId(user)
                    )}"
                >

                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3 20 7v5c0 4.5-3 7.6-8 9-5-1.4-8-4.5-8-9V7l8-4Z"></path>
                        <path d="M9 12h6"></path>
                        <path d="M12 9v6"></path>
                    </svg>

                </button>

            </div>

        </td>
    `;


    return row;
}


/* =========================================================
   USER DETAILS
========================================================= */

function openUserModal(user) {

    if (!user) return;

    state.selectedUser = user;


    setText(
        "modalUserName",
        getUserName(user)
    );


    setText(
        "modalUserEmail",
        user.email ||
        "No email address"
    );


    setText(
        "modalUserPhone",
        getUserPhone(user) ||
        "—"
    );


    setText(
        "modalReferralCode",
        user.referral_code ||
        user.referralCode ||
        "—"
    );


    setText(
        "modalUserBalance",
        formatCurrency(
            getUserBalance(user)
        )
    );


    setText(
        "modalUserStatus",
        formatStatus(
            normalizeStatus(
                user.status ||
                "active"
            )
        )
    );


    setText(
        "modalAccountType",
        formatAccountType(
            getAccountType(user)
        )
    );


    setText(
        "modalCreatedAt",
        formatDate(
            getUserCreatedAt(user)
        )
    );


    const modal =
        $("userModal");

    if (!modal) return;

    modal.hidden = false;

    document.body.classList.add(
        "modal-open"
    );
}


function closeUserModal() {

    const modal =
        $("userModal");

    if (!modal) return;

    modal.hidden = true;

    document.body.classList.remove(
        "modal-open"
    );

    state.selectedUser = null;
}


/* =========================================================
   USER ACTIONS
========================================================= */

function handleUserAction(
    action,
    userId
) {

    const user =
        state.users.find(
            item =>
                getUserId(item) ===
                String