"use strict";

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Users
|--------------------------------------------------------------------------
*/

const API_BASE =
    "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const USERS_API =
    `${API_BASE}/admin-users.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;

const PAGE_SIZE = 10;


/*
|--------------------------------------------------------------------------
| State
|--------------------------------------------------------------------------
*/

let allUsers = [];

let filteredUsers = [];

let currentPage = 1;

let selectedUser = null;


/*
|--------------------------------------------------------------------------
| DOM Helpers
|--------------------------------------------------------------------------
*/

function byId(id) {
    return document.getElementById(id);
}


function showMessage(message, type = "error") {

    const element = byId("usersMessage");

    if (!element) return;

    element.textContent = message;

    element.className =
        `admin-message ${type}`;

    element.style.display = "block";
}


function hideMessage() {

    const element = byId("usersMessage");

    if (!element) return;

    element.style.display = "none";
}


/*
|--------------------------------------------------------------------------
| Page Loader
|--------------------------------------------------------------------------
*/

function hidePageLoader() {

    const loader = byId("pageLoader");

    if (!loader) return;

    loader.classList.add("hidden");

    setTimeout(() => {

        loader.style.display = "none";

    }, 300);
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

async function verifyAdministrator() {

    try {

        const response = await fetch(
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


        let data = {};

        try {

            data = await response.json();

        } catch (error) {

            data = {};
        }


        if (response.status === 401) {

            showMessage(
                "Your administrator session has expired. Please login again.",
                "error"
            );

            hidePageLoader();

            setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 1200);

            return false;
        }


        if (response.status === 403) {

            showMessage(
                data.message ||
                "Administrator access is required.",
                "error"
            );

            hidePageLoader();

            return false;
        }


        if (!response.ok || data.success !== true) {

            showMessage(
                data.message ||
                "Administrator verification failed.",
                "error"
            );

            hidePageLoader();

            return false;
        }


        return true;


    } catch (error) {

        console.error(
            "Administrator verification error:",
            error
        );

        showMessage(
            "Unable to verify administrator session. Please check your connection.",
            "error"
        );

        hidePageLoader();

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| Load Admin Profile
|--------------------------------------------------------------------------
*/

async function loadAdminProfile() {

    try {

        const response = await fetch(
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
            !data.success ||
            !data.user
        ) {

            return;
        }


        const user = data.user;


        const fullName =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`
                .trim() ||
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
            "Admin Account";


        [
            "adminName",
            "headerUserName"
        ].forEach(id => {

            const element = byId(id);

            if (element) {

                element.textContent =
                    fullName;
            }
        });


        const firstNameElement =
            byId("adminFirstName");

        if (firstNameElement) {

            firstNameElement.textContent =
                firstName;
        }


        const emailElement =
            byId("adminEmail");

        if (emailElement) {

            emailElement.textContent =
                email;
        }


        const typeElement =
            byId("adminAccountType");

        if (typeElement) {

            typeElement.textContent =
                accountType;
        }


        [
            "adminAvatar",
            "accountAvatar"
        ].forEach(id => {

            const element = byId(id);

            if (element) {

                element.textContent =
                    firstName
                        .charAt(0)
                        .toUpperCase();
            }
        });


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );
    }
}


/*
|--------------------------------------------------------------------------
| Load Users
|--------------------------------------------------------------------------
*/

async function loadUsers() {

    const loading =
        byId("usersLoading");

    const empty =
        byId("usersEmpty");

    const tableBody =
        byId("usersTableBody");


    if (loading) {

        loading.style.display =
            "block";
    }


    if (empty) {

        empty.style.display =
            "none";
    }


    if (tableBody) {

        tableBody.innerHTML = "";
    }


    hideMessage();


    try {

        const response = await fetch(
            USERS_API,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        let data = {};

        try {

            data = await response.json();

        } catch (error) {

            data = {};
        }


        /*
        |--------------------------------------------------------------------------
        | Unauthorized
        |--------------------------------------------------------------------------
        */

        if (response.status === 401) {

            showMessage(
                "Your administrator session has expired. Please login again.",
                "error"
            );

            setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 1200);

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Forbidden
        |--------------------------------------------------------------------------
        */

        if (response.status === 403) {

            showMessage(
                data.message ||
                "Administrator access is required.",
                "error"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Server Error
        |--------------------------------------------------------------------------
        */

        if (!response.ok) {

            showMessage(
                data.message ||
                "Unable to load users.",
                "error"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | API Error
        |--------------------------------------------------------------------------
        */

        if (data.success !== true) {

            showMessage(
                data.message ||
                "Unable to load users.",
                "error"
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Get User Array
        |--------------------------------------------------------------------------
        */

        allUsers =
            Array.isArray(data.users)
                ? data.users
                : Array.isArray(data.data)
                    ? data.data
                    : [];


        filteredUsers =
            [...allUsers];


        /*
        |--------------------------------------------------------------------------
        | Statistics
        |--------------------------------------------------------------------------
        */

        updateStatistics(
            data.stats || data
        );


        currentPage = 1;

        renderUsers();

        renderPagination();


    } catch (error) {

        console.error(
            "Users loading error:",
            error
        );

        showMessage(
            "Unable to connect to the Crown Cash user management server.",
            "error"
        );


    } finally {

        if (loading) {

            loading.style.display =
                "none";
        }

        hidePageLoader();
    }
}


/*
|--------------------------------------------------------------------------
| Statistics
|--------------------------------------------------------------------------
*/

function updateStatistics(stats) {

    const total =
        Number(
            stats.total_users ??
            allUsers.length ??
            0
        );


    const active =
        Number(
            stats.active_users ??
            allUsers.filter(
                user =>
                    String(
                        user.status || ""
                    ).toLowerCase() === "active"
            ).length
        );


    const blocked =
        Number(
            stats.blocked_users ??
            allUsers.filter(
                user =>
                    [
                        "blocked",
                        "suspended",
                        "disabled",
                        "banned"
                    ].includes(
                        String(
                            user.status || ""
                        ).toLowerCase()
                    )
            ).length
        );


    const admins =
        Number(
            stats.admin_users ??
            allUsers.filter(user => {

                const role =
                    String(
                        user.role || ""
                    ).toLowerCase();

                const type =
                    String(
                        user.account_type || ""
                    ).toLowerCase();

                return (
                    role === "admin" ||
                    role === "administrator" ||
                    type === "admin" ||
                    type === "administrator"
                );
            }).length
        );


    setText(
        "totalUsers",
        total
    );

    setText(
        "activeUsers",
        active
    );

    setText(
        "blockedUsers",
        blocked
    );

    setText(
        "adminUsers",
        admins
    );
}


/*
|--------------------------------------------------------------------------
| Render Users
|--------------------------------------------------------------------------
*/

function renderUsers() {

    const tableBody =
        byId("usersTableBody");

    const empty =
        byId("usersEmpty");


    if (!tableBody) return;


    tableBody.innerHTML = "";


    const start =
        (currentPage - 1) *
        PAGE_SIZE;


    const end =
        start + PAGE_SIZE;


    const pageUsers =
        filteredUsers.slice(
            start,
            end
        );


    if (
        pageUsers.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "block";
        }

        return;
    }


    if (empty) {

        empty.style.display =
            "none";
    }


    pageUsers.forEach(user => {

        const row =
            document.createElement("tr");


        const name =
            escapeHTML(
                user.full_name ||
                `${user.first_name || ""} ${user.last_name || ""}`
                    .trim() ||
                "Unknown User"
            );


        const phone =
            escapeHTML(
                user.phone || "—"
            );


        const balance =
            formatCurrency(
                user.balance ??
                user.wallet_balance ??
                0
            );


        const status =
            String(
                user.status ||
                "active"
            ).toLowerCase();


        const accountType =
            String(
                user.account_type ||
                "user"
            );


        const joined =
            formatDate(
                user.created_at
            );


        const id =
            escapeAttribute(
                user.id ||
                user._id ||
                user.user_id ||
                ""
            );


        row.innerHTML = `

            <td>

                <div class="user-cell">

                    <div class="user-avatar">
                        ${escapeHTML(
                            getInitial(
                                user.full_name ||
                                user.first_name ||
                                "U"
                            )
                        )}
                    </div>

                    <div class="user-info">

                        <strong>
                            ${name}
                        </strong>

                        <span>
                            ${escapeHTML(
                                user.email || "No email"
                            )}
                        </span>

                    </div>

                </div>

            </td>


            <td>
                ${phone}
            </td>


            <td>
                ${balance}
            </td>


            <td>
                <span class="status-badge ${statusClass(status)}">
                    ${capitalize(status)}
                </span>
            </td>


            <td>
                <span class="account-badge">
                    ${escapeHTML(
                        capitalize(accountType)
                    )}
                </span>
            </td>


            <td>
                ${joined}
            </td>


            <td>

                <button
                    type="button"
                    class="table-action"
                    data-user-id="${id}"
                >
                    <span class="table-action-icon">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            aria-hidden="true"
                        >
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </span>
                    View
                </button>

            </td>
        `;


        tableBody.appendChild(row);
    });


    tableBody
        .querySelectorAll(
            "[data-user-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const userId =
                        button.dataset.userId;

                    openUserModal(
                        userId
                    );
                }
            );
        });
}


/*
|--------------------------------------------------------------------------
| Search + Filters
|--------------------------------------------------------------------------
*/

function applyFilters() {

    const search =
        (
            byId("searchUsers")
                ?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const status =
        (
            byId("statusFilter")
                ?.value ||
            "all"
        )
            .toLowerCase();


    const accountType =
        (
            byId("accountTypeFilter")
                ?.value ||
            "all"
        )
            .toLowerCase();


    filteredUsers =
        allUsers.filter(user => {

            const text = [

                user.full_name,

                user.first_name,

                user.last_name,

                user.email,

                user.phone,

                user.referral_code

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            const userStatus =
                String(
                    user.status ||
                    ""
                ).toLowerCase();


            const userType =
                String(
                    user.account_type ||
                    "user"
                ).toLowerCase();


            const matchesSearch =
                !search ||
                text.includes(search);


            const matchesStatus =
                status === "all" ||
                userStatus === status;


            const matchesType =
                accountType === "all" ||
                userType === accountType;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesType
            );
        });


    currentPage = 1;

    renderUsers();

    renderPagination();
}


/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

function renderPagination() {

    const container =
        byId("pagination");

    if (!container) return;


    container.innerHTML = "";


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredUsers.length /
                PAGE_SIZE
            )
        );


    if (totalPages <= 1) {

        return;
    }


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        const button =
            document.createElement("button");


        button.type =
            "button";


        button.className =
            page === currentPage
                ? "active"
                : "";


        button.textContent =
            page;


        button.addEventListener(
            "click",
            () => {

                currentPage =
                    page;

                renderUsers();

                renderPagination();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );


        container.appendChild(
            button
        );
    }
}


/*
|--------------------------------------------------------------------------
| User Modal
|--------------------------------------------------------------------------
*/

function openUserModal(userId) {

    const user =
        allUsers.find(
            item =>
                String(
                    item.id ||
                    item._id ||
                    item.user_id ||
                    ""
                ) === String(userId)
        );


    if (!user) {

        showMessage(
            "User details could not be found.",
            "error"
        );

        return;
    }


    selectedUser =
        user;


    setText(
        "modalUserName",
        user.full_name ||
        `${user.first_name || ""} ${user.last_name || ""}`
            .trim() ||
        "Unknown User"
    );


    setText(
        "modalUserEmail",
        user.email || "—"
    );


    setText(
        "modalUserPhone",
        user.phone || "—"
    );


    setText(
        "modalReferralCode",
        user.referral_code || "—"
    );


    setText(
        "modalUserBalance",
        formatCurrency(
            user.balance ??
            user.wallet_balance ??
            0
        )
    );


    setText(
        "modalUserStatus",
        capitalize(
            user.status ||
            "active"
        )
    );


    setText(
        "modalAccountType",
        capitalize(
            user.account_type ||
            "user"
        )
    );


    setText(
        "modalCreatedAt",
        formatDate(
            user.created_at
        )
    );


    const avatar =
        byId("modalUserAvatar");


    if (avatar) {

        avatar.textContent =
            getInitial(
                user.full_name ||
                user.first_name ||
                "U"
            );
    }


    const modal =
        byId("userModal");


    if (modal) {

        modal.classList.add(
            "open"
        );

        modal.style.display =
            "flex";
    }
}


function closeUserModal() {

    const modal =
        byId("userModal");


    if (!modal) return;


    modal.classList.remove(
        "open"
    );


    modal.style.display =
        "none";


    selectedUser =
        null;
}


/*
|--------------------------------------------------------------------------
| Sidebar
|--------------------------------------------------------------------------
*/

function setupSidebar() {

    const sidebar =
        byId("sidebar");

    const overlay =
        byId("sidebarOverlay");

    const menuButton =
        byId("menuButton");

    const closeButton =
        byId("sidebarClose");


    function openSidebar() {

        sidebar?.classList.add(
            "open"
        );

        overlay?.classList.add(
            "open"
        );

        document.body.classList.add(
            "sidebar-open"
        );
    }


    function closeSidebar() {

        sidebar?.classList.remove(
            "open"
        );

        overlay?.classList.remove(
            "open"
        );

        document.body.classList.remove(
            "sidebar-open"
        );
    }


    menuButton?.addEventListener(
        "click",
        openSidebar
    );


    closeButton?.addEventListener(
        "click",
        closeSidebar
    );


    overlay?.addEventListener(
        "click",
        closeSidebar
    );


    sidebar
        ?.querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );
        });
}


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

async function logout() {

    try {

        await fetch(
            LOGOUT_API,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    window.location.href =
        "login.html";
}


/*
|--------------------------------------------------------------------------
| Utilities
|--------------------------------------------------------------------------
*/

function setText(id, value) {

    const element =
        byId(id);

    if (element) {

        element.textContent =
            value;
    }
}


function formatCurrency(value) {

    const amount =
        Number(value) || 0;


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


function formatDate(value) {

    if (!value) {

        return "—";
    }


    const date =
        new Date(value);


    if (Number.isNaN(
        date.getTime()
    )) {

        return String(value);
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


function getInitial(name) {

    return String(name || "U")
        .trim()
        .charAt(0)
        .toUpperCase();
}


function capitalize(value) {

    const text =
        String(value || "");


    return text
        .charAt(0)
        .toUpperCase() +
        text.slice(1);
}


function statusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();


    if (
        value === "active"
    ) {

        return "success";
    }


    if (
        value === "pending"
    ) {

        return "pending";
    }


    if (
        value === "suspended" ||
        value === "blocked" ||
        value === "disabled" ||
        value === "banned"
    ) {

        return "danger";
    }


    return "neutral";
}


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


/*
|--------------------------------------------------------------------------
| Events
|--------------------------------------------------------------------------
*/

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupSidebar();


        byId("searchUsers")
            ?.addEventListener(
                "input",
                applyFilters
            );


        byId("statusFilter")
            ?.addEventListener(
                "change",
                applyFilters
            );


        byId("accountTypeFilter")
            ?.addEventListener(
                "change",
                applyFilters
            );


        byId("refreshUsersBtn")
            ?.addEventListener(
                "click",
                async () => {

                    await loadUsers();
                }
            );


        byId("closeUserModal")
            ?.addEventListener(
                "click",
                closeUserModal
            );


        byId("userModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target.id ===
                        "userModal"
                    ) {

                        closeUserModal();
                    }
                }
            );


        byId("logoutBtn")
            ?.addEventListener(
                "click",
                logout
            );


        /*
        |--------------------------------------------------------------------------
        | Authenticate First
        |--------------------------------------------------------------------------
        */

        const authenticated =
            await verifyAdministrator();


        if (!authenticated) {

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Load Profile + Users
        |--------------------------------------------------------------------------
        */

        await Promise.all([
            loadAdminProfile(),
            loadUsers()
        ]);


        hidePageLoader();
    }
);


/*
|--------------------------------------------------------------------------
| Public API
|--------------------------------------------------------------------------
*/

window.CrownCashAdminUsers = {

    loadUsers,

    applyFilters,

    getUsers: () =>
        [...allUsers],

    getSelectedUser: () =>
        selectedUser,

    closeUserModal
};