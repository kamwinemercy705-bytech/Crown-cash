"use strict";

/*
|--------------------------------------------------------------------------
| CROWN CASH — ADMIN USER MANAGEMENT
|--------------------------------------------------------------------------
| Complete frontend controller for admin-users.html
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const PROFILE_API = `${API_BASE}/profile.php`;
const USERS_API = `${API_BASE}/admin-users.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;

const PAGE_SIZE = 10;

/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

let users = [];
let filteredUsers = [];

let currentPage = 1;
let selectedUser = null;

let isLoadingUsers = false;


/*
|--------------------------------------------------------------------------
| DOM HELPERS
|--------------------------------------------------------------------------
*/

function $(id) {
    return document.getElementById(id);
}


/*
|--------------------------------------------------------------------------
| PAGE LOADER
|--------------------------------------------------------------------------
|
| IMPORTANT:
| We use direct style.display instead of relying only on a CSS class.
| This prevents the "Loading user management..." screen from remaining
| visible when CSS class rules fail.
|
|--------------------------------------------------------------------------
*/

function hidePageLoader() {

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    loader.style.pointerEvents = "none";

    setTimeout(() => {
        loader.style.display = "none";
    }, 250);
}


function showPageLoader() {

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.visibility = "visible";
    loader.style.pointerEvents = "auto";
}


/*
|--------------------------------------------------------------------------
| MESSAGE
|--------------------------------------------------------------------------
*/

function showMessage(message, type = "info") {

    const box = $("usersMessage");

    if (!box) {
        return;
    }

    box.textContent = message;

    box.className = `admin-message ${type}`;

    box.style.display = "block";

    setTimeout(() => {

        if (box.textContent === message) {
            box.style.display = "none";
        }

    }, 5000);
}


/*
|--------------------------------------------------------------------------
| NUMBER HELPERS
|--------------------------------------------------------------------------
*/

function numberValue(value) {

    if (value === null || value === undefined) {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "object") {

        if (typeof value.$numberDecimal !== "undefined") {
            return parseFloat(value.$numberDecimal) || 0;
        }

        if (typeof value.$numberLong !== "undefined") {
            return parseFloat(value.$numberLong) || 0;
        }

        if (typeof value.value !== "undefined") {
            return numberValue(value.value);
        }
    }

    const parsed = parseFloat(value);

    return Number.isFinite(parsed) ? parsed : 0;
}


function formatCurrency(value) {

    const amount = numberValue(value);

    return "UGX " + amount.toLocaleString("en-UG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    try {

        let date;

        if (typeof value === "object" && value.$date) {
            date = new Date(value.$date);
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-UG", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    } catch (error) {
        return "—";
    }
}


/*
|--------------------------------------------------------------------------
| ID HELPERS
|--------------------------------------------------------------------------
*/

function getUserId(user) {

    if (!user) {
        return "";
    }

    if (user.id) {
        return String(user.id);
    }

    if (user.user_id) {
        return String(user.user_id);
    }

    if (user._id) {

        if (typeof user._id === "string") {
            return user._id;
        }

        if (user._id.$oid) {
            return String(user._id.$oid);
        }

        if (user._id.oid) {
            return String(user._id.oid);
        }
    }

    return "";
}


/*
|--------------------------------------------------------------------------
| NAME HELPERS
|--------------------------------------------------------------------------
*/

function getFullName(user) {

    if (!user) {
        return "Unknown User";
    }

    if (user.full_name) {
        return String(user.full_name);
    }

    const firstName = String(
        user.first_name ||
        user.firstName ||
        ""
    ).trim();

    const lastName = String(
        user.last_name ||
        user.lastName ||
        ""
    ).trim();

    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
        return fullName;
    }

    return user.name || "Unknown User";
}


function getInitials(user) {

    const name = getFullName(user);

    const parts = name
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return "U";
    }

    if (parts.length === 1) {
        return parts[0].substring(0, 1).toUpperCase();
    }

    return (
        parts[0].substring(0, 1) +
        parts[parts.length - 1].substring(0, 1)
    ).toUpperCase();
}


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function normalizeStatus(status) {

    const value = String(status || "active")
        .trim()
        .toLowerCase();

    return value || "active";
}


function statusLabel(status) {

    const value = normalizeStatus(status);

    return value.charAt(0).toUpperCase() + value.slice(1);
}


function statusClass(status) {

    const value = normalizeStatus(status);

    switch (value) {

        case "active":
            return "success";

        case "pending":
            return "warning";

        case "suspended":
            return "warning";

        case "blocked":
            return "danger";

        case "disabled":
            return "danger";

        default:
            return "neutral";
    }
}


/*
|--------------------------------------------------------------------------
| ACCOUNT TYPE
|--------------------------------------------------------------------------
*/

function getAccountType(user) {

    if (!user) {
        return "user";
    }

    return String(
        user.account_type ||
        user.accountType ||
        user.role ||
        "user"
    ).toLowerCase();
}


function accountLabel(user) {

    const type = getAccountType(user);

    if (
        type === "admin" ||
        type === "administrator"
    ) {
        return "Admin";
    }

    return "User";
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

async function verifyAdmin() {

    try {

        const response = await fetch(ADMIN_AUTH_API, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        return (
            data &&
            data.success === true &&
            data.authenticated === true &&
            data.authorized === true
        );

    } catch (error) {

        console.error(
            "Administrator authentication error:",
            error
        );

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

async function loadAdminProfile() {

    try {

        const response = await fetch(PROFILE_API, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (!data || data.success !== true || !data.user) {
            return;
        }

        const user = data.user;

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
            "Admin Account";

        const accountType =
            user.account_type ||
            user.role ||
            "Administrator";

        const nameElements = [
            $("adminName"),
            $("headerUserName")
        ];

        nameElements.forEach(element => {

            if (element) {
                element.textContent = fullName;
            }

        });

        const firstNameElement = $("adminFirstName");

        if (firstNameElement) {
            firstNameElement.textContent = firstName;
        }

        const emailElement = $("adminEmail");

        if (emailElement) {
            emailElement.textContent = email;
        }

        const accountTypeElement = $("adminAccountType");

        if (accountTypeElement) {
            accountTypeElement.textContent = accountType;
        }

        const initials = getInitials(user);

        [
            $("adminAvatar"),
            $("accountAvatar")
        ].forEach(element => {

            if (element) {
                element.textContent = initials;
            }

        });

    } catch (error) {

        console.error(
            "Unable to load administrator profile:",
            error
        );
    }
}


/*
|--------------------------------------------------------------------------
| LOAD USERS
|--------------------------------------------------------------------------
*/

async function loadUsers() {

    if (isLoadingUsers) {
        return;
    }

    isLoadingUsers = true;

    const tableBody = $("usersTableBody");
    const loading = $("usersLoading");
    const empty = $("usersEmpty");

    if (loading) {
        loading.style.display = "block";
    }

    if (empty) {
        empty.style.display = "none";
    }

    if (tableBody) {
        tableBody.innerHTML = "";
    }

    try {

        const response = await fetch(USERS_API, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (response.status === 401 || response.status === 403) {

            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {

            throw new Error(
                `Server returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!data || data.success !== true) {

            throw new Error(
                data?.message ||
                "Unable to load users."
            );
        }

        users = Array.isArray(data.users)
            ? data.users
            : [];

        /*
        |--------------------------------------------------------------------------
        | Statistics
        |--------------------------------------------------------------------------
        */

        updateStatistics(data);

        /*
        |--------------------------------------------------------------------------
        | Initial filtering
        |--------------------------------------------------------------------------
        */

        applyFilters();

    } catch (error) {

        console.error(
            "User management error:",
            error
        );

        users = [];
        filteredUsers = [];

        updateStatistics({
            total_users: 0,
            active_users: 0,
            blocked_users: 0,
            admin_users: 0
        });

        if (tableBody) {
            tableBody.innerHTML = "";
        }

        if (loading) {
            loading.style.display = "none";
        }

        if (empty) {
            empty.style.display = "block";
        }

        showMessage(
            error.message ||
            "Unable to load users. Please try again.",
            "error"
        );

    } finally {

        isLoadingUsers = false;

        if (loading) {
            loading.style.display = "none";
        }

        /*
        |--------------------------------------------------------------------------
        | CRITICAL FIX
        |--------------------------------------------------------------------------
        | Always remove the full-screen loader after the page has attempted
        | authentication/data loading.
        |--------------------------------------------------------------------------
        */

        hidePageLoader();
    }
}


/*
|--------------------------------------------------------------------------
| STATISTICS
|--------------------------------------------------------------------------
*/

function updateStatistics(data) {

    let total = numberValue(data?.total_users);
    let active = numberValue(data?.active_users);
    let blocked = numberValue(data?.blocked_users);
    let admins = numberValue(data?.admin_users);

    /*
    |--------------------------------------------------------------------------
    | If backend statistics are missing, calculate from loaded users.
    |--------------------------------------------------------------------------
    */

    if (!total && users.length) {
        total = users.length;
    }

    if (!active && users.length) {

        active = users.filter(user =>
            normalizeStatus(user.status) === "active"
        ).length;
    }

    if (!blocked && users.length) {

        blocked = users.filter(user =>
            ["blocked", "disabled", "suspended"]
                .includes(normalizeStatus(user.status))
        ).length;
    }

    if (!admins && users.length) {

        admins = users.filter(user => {

            const type = getAccountType(user);

            return (
                type === "admin" ||
                type === "administrator"
            );

        }).length;
    }

    if ($("totalUsers")) {
        $("totalUsers").textContent = total.toLocaleString();
    }

    if ($("activeUsers")) {
        $("activeUsers").textContent = active.toLocaleString();
    }

    if ($("blockedUsers")) {
        $("blockedUsers").textContent = blocked.toLocaleString();
    }

    if ($("adminUsers")) {
        $("adminUsers").textContent = admins.toLocaleString();
    }
}


/*
|--------------------------------------------------------------------------
| FILTERS
|--------------------------------------------------------------------------
*/

function applyFilters() {

    const searchInput = $("searchUsers");
    const statusSelect = $("statusFilter");
    const accountTypeSelect = $("accountTypeFilter");

    const search = String(
        searchInput?.value || ""
    ).trim().toLowerCase();

    const status = String(
        statusSelect?.value || "all"
    ).toLowerCase();

    const accountType = String(
        accountTypeSelect?.value || "all"
    ).toLowerCase();

    filteredUsers = users.filter(user => {

        const name = getFullName(user).toLowerCase();

        const email = String(
            user.email || ""
        ).toLowerCase();

        const phone = String(
            user.phone ||
            user.phone_number ||
            user.mobile ||
            ""
        ).toLowerCase();

        const referralCode = String(
            user.referral_code ||
            ""
        ).toLowerCase();

        const userStatus = normalizeStatus(
            user.status
        );

        const userAccountType = getAccountType(user);

        const matchesSearch =
            !search ||
            name.includes(search) ||
            email.includes(search) ||
            phone.includes(search) ||
            referralCode.includes(search);

        const matchesStatus =
            status === "all" ||
            userStatus === status;

        let matchesAccountType = true;

        if (accountType !== "all") {

            if (accountType === "admin") {

                matchesAccountType =
                    userAccountType === "admin" ||
                    userAccountType === "administrator";

            } else if (accountType === "user") {

                matchesAccountType =
                    userAccountType !== "admin" &&
                    userAccountType !== "administrator";

            } else {

                matchesAccountType =
                    userAccountType === accountType;
            }
        }

        return (
            matchesSearch &&
            matchesStatus &&
            matchesAccountType
        );
    });

    currentPage = 1;

    renderUsers();
}


/*
|--------------------------------------------------------------------------
| RENDER USERS
|--------------------------------------------------------------------------
*/

function renderUsers() {

    const tableBody = $("usersTableBody");
    const loading = $("usersLoading");
    const empty = $("usersEmpty");

    if (!tableBody) {
        return;
    }

    if (loading) {
        loading.style.display = "none";
    }

    tableBody.innerHTML = "";

    if (!filteredUsers.length) {

        if (empty) {
            empty.style.display = "block";
        }

        renderPagination(0);

        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

    const start =
        (currentPage - 1) * PAGE_SIZE;

    const end =
        start + PAGE_SIZE;

    const pageUsers =
        filteredUsers.slice(start, end);

    pageUsers.forEach(user => {

        const row =
            document.createElement("tr");

        const id = getUserId(user);

        const name = getFullName(user);

        const phone =
            user.phone ||
            user.phone_number ||
            user.mobile ||
            "—";

        const balance =
            user.balance ??
            user.wallet_balance ??
            0;

        const status =
            normalizeStatus(user.status);

        const account =
            accountLabel(user);

        const joined =
            formatDate(
                user.created_at ||
                user.createdAt
            );

        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar">
                        ${escapeHtml(getInitials(user))}
                    </div>

                    <div class="user-details">
                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <span>
                            ${escapeHtml(
                                user.email || "No email"
                            )}
                        </span>
                    </div>
                </div>
            </td>

            <td>
                ${escapeHtml(String(phone))}
            </td>

            <td>
                <strong class="balance-value">
                    ${formatCurrency(balance)}
                </strong>
            </td>

            <td>
                <span class="status-badge ${statusClass(status)}">
                    ${escapeHtml(statusLabel(status))}
                </span>
            </td>

            <td>
                <span class="account-badge">
                    ${escapeHtml(account)}
                </span>
            </td>

            <td>
                ${escapeHtml(joined)}
            </td>

            <td>
                <button
                    type="button"
                    class="table-action"
                    data-view-user="${escapeHtml(id)}"
                    aria-label="View ${escapeHtml(name)}"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
                        <circle cx="12" cy="12" r="2.5"/>
                    </svg>

                    <span>View</span>
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    renderPagination(filteredUsers.length);
}


/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

function renderPagination(totalItems) {

    const pagination = $("pagination");

    if (!pagination) {
        return;
    }

    pagination.innerHTML = "";

    const totalPages =
        Math.ceil(totalItems / PAGE_SIZE);

    if (totalPages <= 1) {
        return;
    }

    const previousButton =
        document.createElement("button");

    previousButton.type = "button";
    previousButton.className = "pagination-button";
    previousButton.textContent = "Previous";
    previousButton.disabled =
        currentPage === 1;

    previousButton.addEventListener(
        "click",
        () => {

            if (currentPage > 1) {

                currentPage--;

                renderUsers();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        }
    );

    pagination.appendChild(previousButton);

    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "pagination-button" +
            (
                page === currentPage
                    ? " active"
                    : ""
            );

        button.textContent = page;

        button.addEventListener(
            "click",
            () => {

                currentPage = page;

                renderUsers();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );

        pagination.appendChild(button);
    }

    const nextButton =
        document.createElement("button");

    nextButton.type = "button";
    nextButton.className = "pagination-button";
    nextButton.textContent = "Next";

    nextButton.disabled =
        currentPage === totalPages;

    nextButton.addEventListener(
        "click",
        () => {

            if (currentPage < totalPages) {

                currentPage++;

                renderUsers();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        }
    );

    pagination.appendChild(nextButton);
}


/*
|--------------------------------------------------------------------------
| USER MODAL
|--------------------------------------------------------------------------
*/

function openUserModal(user) {

    if (!user) {
        return;
    }

    selectedUser = user;

    const modal = $("userModal");

    if (!modal) {
        return;
    }

    const fullName = getFullName(user);

    const phone =
        user.phone ||
        user.phone_number ||
        user.mobile ||
        "—";

    const balance =
        user.balance ??
        user.wallet_balance ??
        0;

    const status =
        normalizeStatus(user.status);

    const accountType =
        accountLabel(user);

    if ($("modalUserAvatar")) {
        $("modalUserAvatar").textContent =
            getInitials(user);
    }

    if ($("modalUserName")) {
        $("modalUserName").textContent =
            fullName;
    }

    if ($("modalUserEmail")) {
        $("modalUserEmail").textContent =
            user.email || "—";
    }

    if ($("modalUserPhone")) {
        $("modalUserPhone").textContent =
            phone;
    }

    if ($("modalReferralCode")) {
        $("modalReferralCode").textContent =
            user.referral_code || "—";
    }

    if ($("modalUserBalance")) {
        $("modalUserBalance").textContent =
            formatCurrency(balance);
    }

    if ($("modalUserStatus")) {
        $("modalUserStatus").textContent =
            statusLabel(status);

        $("modalUserStatus").className =
            `status-badge ${statusClass(status)}`;
    }

    if ($("modalAccountType")) {
        $("modalAccountType").textContent =
            accountType;
    }

    if ($("modalCreatedAt")) {
        $("modalCreatedAt").textContent =
            formatDate(
                user.created_at ||
                user.createdAt
            );
    }

    modal.style.display = "flex";

    document.body.classList.add(
        "modal-open"
    );
}


function closeUserModal() {

    const modal = $("userModal");

    if (!modal) {
        return;
    }

    modal.style.display = "none";

    document.body.classList.remove(
        "modal-open"
    );

    selectedUser = null;
}


/*
|--------------------------------------------------------------------------
| SEARCH / FILTER EVENTS
|--------------------------------------------------------------------------
*/

function setupFilters() {

    const search = $("searchUsers");

    if (search) {

        search.addEventListener(
            "input",
            applyFilters
        );
    }

    const status = $("statusFilter");

    if (status) {

        status.addEventListener(
            "change",
            applyFilters
        );
    }

    const accountType =
        $("accountTypeFilter");

    if (accountType) {

        accountType.addEventListener(
            "change",
            applyFilters
        );
    }
}


/*
|--------------------------------------------------------------------------
| REFRESH
|--------------------------------------------------------------------------
*/

function setupRefresh() {

    const button =
        $("refreshUsersBtn");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            const original =
                button.innerHTML;

            button.innerHTML = `
                <span class="button-spinner"></span>
                Refreshing
            `;

            try {

                await loadUsers();

                showMessage(
                    "User list refreshed successfully.",
                    "success"
                );

            } finally {

                button.disabled = false;

                button.innerHTML = original;
            }
        }
    );
}


/*
|--------------------------------------------------------------------------
| TABLE CLICK HANDLING
|--------------------------------------------------------------------------
*/

function setupTableActions() {

    const tableBody =
        $("usersTableBody");

    if (!tableBody) {
        return;
    }

    tableBody.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-view-user]"
                );

            if (!button) {
                return;
            }

            const id =
                button.getAttribute(
                    "data-view-user"
                );

            const user =
                users.find(
                    item => getUserId(item) === id
                );

            if (user) {
                openUserModal(user);
            }
        }
    );
}


/*
|--------------------------------------------------------------------------
| MODAL EVENTS
|--------------------------------------------------------------------------
*/

function setupModal() {

    const closeButton =
        $("closeUserModal");

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeUserModal
        );
    }

    const modal =
        $("userModal");

    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {
                    closeUserModal();
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
                closeUserModal();
            }
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Management button
    |--------------------------------------------------------------------------
    */

    const manageButton =
        $("manageUserBtn");

    if (manageButton) {

        manageButton.addEventListener(
            "click",
            () => {

                if (!selectedUser) {
                    return;
                }

                if (
                    window.CrownCashAdminUserActions &&
                    typeof window.CrownCashAdminUserActions.open === "function"
                ) {

                    window.CrownCashAdminUserActions.open(
                        selectedUser
                    );

                    return;
                }

                showMessage(
                    "User management controls are loading.",
                    "info"
                );
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| SIDEBAR / MOBILE MENU
|--------------------------------------------------------------------------
*/

function setupSidebar() {

    const sidebar =
        $("sidebar");

    const overlay =
        $("sidebarOverlay");

    const menuButton =
        $("menuButton");

    const closeButton =
        $("sidebarClose");

    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("open");
        }

        if (overlay) {
            overlay.classList.add("show");
        }

        document.body.classList.add(
            "sidebar-open"
        );
    }

    function closeSidebar() {

        if (sidebar) {
            sidebar.classList.remove("open");
        }

        if (overlay) {
            overlay.classList.remove("show");
        }

        document.body.classList.remove(
            "sidebar-open"
        );
    }

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            openSidebar
        );
    }

    if (closeButton) {

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
            ".sidebar a"
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <= 900
                    ) {
                        closeSidebar();
                    }
                }
            );
        });
}


/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

function setupLogout() {

    const logoutButton =
        $("logoutBtn");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );

            if (!confirmed) {
                return;
            }

            logoutButton.disabled = true;

            try {

                await fetch(LOGOUT_API, {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                });

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
}


/*
|--------------------------------------------------------------------------
| HTML ESCAPE
|--------------------------------------------------------------------------
*/

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
|--------------------------------------------------------------------------
| INITIALIZATION
|--------------------------------------------------------------------------
*/

async function initializeAdminUsers() {

    /*
    |--------------------------------------------------------------------------
    | Emergency loader timeout
    |--------------------------------------------------------------------------
    | Even if something unexpected happens, the user will never be trapped
    | on the loading screen indefinitely.
    |--------------------------------------------------------------------------
    */

    const emergencyLoaderTimer =
        setTimeout(() => {

            hidePageLoader();

        }, 10000);


    try {

        showPageLoader();

        setupFilters();
        setupRefresh();
        setupTableActions();
        setupModal();
        setupSidebar();
        setupLogout();

        /*
        |--------------------------------------------------------------------------
        | Verify administrator
        |--------------------------------------------------------------------------
        */

        const authorized =
            await verifyAdmin();

        if (!authorized) {

            clearTimeout(
                emergencyLoaderTimer
            );

            hidePageLoader();

            window.location.href =
                "login.html";

            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Load administrator information
        |--------------------------------------------------------------------------
        */

        await loadAdminProfile();

        /*
        |--------------------------------------------------------------------------
        | Load users
        |--------------------------------------------------------------------------
        */

        await loadUsers();

    } catch (error) {

        console.error(
            "Admin Users initialization error:",
            error
        );

        showMessage(
            "Unable to initialize User Management. Please refresh the page.",
            "error"
        );

    } finally {

        clearTimeout(
            emergencyLoaderTimer
        );

        /*
        |--------------------------------------------------------------------------
        | FINAL GUARANTEE
        |--------------------------------------------------------------------------
        */

        hidePageLoader();
    }
}


/*
|--------------------------------------------------------------------------
| PUBLIC API
|--------------------------------------------------------------------------
*/

window.CrownCashAdminUsers = {

    loadUsers,

    applyFilters,

    openUserModal,

    closeUserModal,

    getSelectedUser: () => selectedUser,

    getUsers: () => users,

    getFilteredUsers: () => filteredUsers
};


/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminUsers
    );

} else {

    initializeAdminUsers();
}