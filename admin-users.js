/* =========================================================
   CROWN CASH — ADMIN USER MANAGEMENT
   admin-users.js
   ========================================================= */

"use strict";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

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
   APPLICATION STATE
   ========================================================= */

let allUsers = [];
let filteredUsers = [];

let currentPage = 1;
let selectedUser = null;

let isLoadingUsers = false;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}


/* =========================================================
   LOADER
   ========================================================= */

function hidePageLoader() {
    const loader = $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    loader.style.pointerEvents = "none";

    setTimeout(() => {
        if (loader) {
            loader.style.display = "none";
        }
    }, 350);
}


function showPageLoader(title = "Loading user management") {
    const loader = $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.visibility = "visible";
    loader.style.pointerEvents = "auto";

    loader.classList.remove("hidden");

    const titleElement =
        loader.querySelector("[data-loader-title]");

    const messageElement =
        loader.querySelector("[data-loader-message]");

    if (titleElement) {
        titleElement.textContent = title;
    }

    if (messageElement) {
        messageElement.textContent =
            "Securing your administrator session...";
    }
}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 12000
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
                ...options,
                signal: controller.signal
            });

        return response;

    } finally {

        clearTimeout(timer);
    }
}


/* =========================================================
   JSON RESPONSE HELPER
   ========================================================= */

async function readJson(response) {

    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {

        console.error(
            "Invalid JSON response:",
            text
        );

        return {
            success: false,
            message: "Invalid server response."
        };
    }
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function verifyAdmin() {

    try {

        const response =
            await fetchWithTimeout(
                ADMIN_AUTH_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                },
                12000
            );

        const data =
            await readJson(response);

        console.log(
            "Admin authentication:",
            data
        );

        if (
            response.ok &&
            data.success === true &&
            data.authorized === true
        ) {

            return true;
        }

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.href =
                "login.html?redirect=admin-users.html";

            return false;
        }

        throw new Error(
            data.message ||
            "Administrator authentication failed."
        );

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        showUsersMessage(
            "Unable to verify administrator session. Please refresh the page.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const response =
            await fetchWithTimeout(
                PROFILE_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                },
                12000
            );

        const data =
            await readJson(response);

        if (
            !response.ok ||
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

        const firstName =
            user.first_name ||
            fullName.split(" ")[0] ||
            "Administrator";

        const email =
            user.email ||
            "";

        setText(
            "#adminName",
            fullName
        );

        setText(
            "#headerUserName",
            fullName
        );

        setText(
            "#adminFirstName",
            firstName
        );

        setText(
            "#adminEmail",
            email
        );

        setText(
            "#accountName",
            fullName
        );

        setText(
            "#adminAccountType",
            "Admin Account"
        );

        const avatar =
            firstName
                .charAt(0)
                .toUpperCase();

        setText(
            "#adminAvatar",
            avatar
        );

        setText(
            "#accountAvatar",
            avatar
        );

    } catch (error) {

        console.warn(
            "Profile could not be loaded:",
            error
        );
    }
}


/* =========================================================
   LOAD USERS
   ========================================================= */

async function loadUsers() {

    if (isLoadingUsers) {
        return;
    }

    isLoadingUsers = true;

    showUsersLoading(true);

    try {

        const response =
            await fetchWithTimeout(
                USERS_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                },
                15000
            );

        const data =
            await readJson(response);

        console.log(
            "Users API response:",
            data
        );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.href =
                "login.html?redirect=admin-users.html";

            return;
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load users."
            );
        }

        if (data.success !== true) {

            throw new Error(
                data.message ||
                "Unable to load users."
            );
        }

        allUsers =
            Array.isArray(data.users)
                ? data.users
                : [];

        updateStatistics(
            data.stats || {}
        );

        applyFilters();

        showUsersMessage(
            "",
            ""
        );

    } catch (error) {

        console.error(
            "Load users error:",
            error
        );

        allUsers = [];
        filteredUsers = [];

        updateStatistics({});

        renderUsers();

        showUsersMessage(
            error.name === "AbortError"
                ? "The server took too long to respond. Please try again."
                : (
                    error.message ||
                    "Unable to load users."
                ),
            "error"
        );

    } finally {

        isLoadingUsers = false;

        showUsersLoading(false);
    }
}


/* =========================================================
   NORMALIZE USER
   ========================================================= */

function normalizeUser(user) {

    if (!user || typeof user !== "object") {
        return {};
    }

    const firstName =
        user.first_name ||
        "";

    const lastName =
        user.last_name ||
        "";

    const fullName =
        user.full_name ||
        `${firstName} ${lastName}`.trim() ||
        "Unknown User";

    return {
        ...user,

        id:
            user.id ||
            user._id ||
            "",

        full_name:
            fullName,

        first_name:
            firstName,

        last_name:
            lastName,

        email:
            user.email ||
            "",

        phone:
            user.phone ||
            user.phone_number ||
            user.mobile ||
            "",

        referral_code:
            user.referral_code ||
            "",

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

        role:
            String(
                user.role ||
                ""
            ).toLowerCase(),

        account_type:
            String(
                user.account_type ||
                "user"
            ).toLowerCase(),

        created_at:
            user.created_at ||
            ""
    };
}


/* =========================================================
   UPDATE STATISTICS
   ========================================================= */

function updateStatistics(stats) {

    const users =
        allUsers.map(normalizeUser);

    const total =
        stats.total_users ??
        users.length;

    const active =
        stats.active_users ??
        users.filter(
            user =>
                user.status === "active"
        ).length;

    const blocked =
        stats.blocked_users ??
        users.filter(
            user =>
                user.status === "blocked"
        ).length;

    const admins =
        stats.admin_users ??
        users.filter(
            user =>
                user.role === "admin" ||
                user.account_type === "admin" ||
                user.account_type === "administrator"
        ).length;

    setText(
        "#totalUsers",
        formatNumber(total)
    );

    setText(
        "#activeUsers",
        formatNumber(active)
    );

    setText(
        "#blockedUsers",
        formatNumber(blocked)
    );

    setText(
        "#adminUsers",
        formatNumber(admins)
    );
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const searchInput =
        $("#searchUsers");

    const statusSelect =
        $("#statusFilter");

    const accountTypeSelect =
        $("#accountTypeFilter");

    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";

    const status =
        statusSelect
            ? statusSelect.value
                .trim()
                .toLowerCase()
            : "";

    const accountType =
        accountTypeSelect
            ? accountTypeSelect.value
                .trim()
                .toLowerCase()
            : "";

    filteredUsers =
        allUsers
            .map(normalizeUser)
            .filter(user => {

                const searchableText =
                    [
                        user.full_name,
                        user.first_name,
                        user.last_name,
                        user.email,
                        user.phone,
                        user.referral_code
                    ]
                        .join(" ")
                        .toLowerCase();

                const matchesSearch =
                    !search ||
                    searchableText.includes(search);

                const matchesStatus =
                    !status ||
                    status === "all" ||
                    user.status === status;

                const matchesAccount =
                    !accountType ||
                    accountType === "all" ||
                    user.account_type === accountType ||
                    (
                        accountType === "admin" &&
                        user.role === "admin"
                    );

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesAccount
                );
            });

    currentPage = 1;

    renderUsers();
}


/* =========================================================
   RENDER USERS
   ========================================================= */

function renderUsers() {

    const tbody =
        $("#usersTableBody");

    const empty =
        $("#usersEmpty");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    if (!filteredUsers.length) {

        if (empty) {
            empty.style.display = "flex";
        }

        renderPagination();

        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

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

    pageUsers.forEach(
        user => {

            const row =
                createUserRow(user);

            tbody.appendChild(row);
        }
    );

    renderPagination();
}


/* =========================================================
   CREATE USER ROW
   ========================================================= */

function createUserRow(user) {

    const row =
        document.createElement("tr");

    const name =
        escapeHtml(
            user.full_name ||
            "Unknown User"
        );

    const phone =
        escapeHtml(
            user.phone ||
            "—"
        );

    const balance =
        formatCurrency(
            user.balance
        );

    const status =
        createStatusBadge(
            user.status
        );

    const account =
        formatAccountType(
            user.account_type,
            user.role
        );

    const joined =
        formatDate(
            user.created_at
        );

    const id =
        escapeHtml(
            String(
                user.id ||
                user._id ||
                ""
            )
        );

    const avatar =
        escapeHtml(
            (
                user.first_name ||
                user.full_name ||
                "U"
            )
                .charAt(0)
                .toUpperCase()
        );

    row.innerHTML = `
        <td>
            <div class="user-table-profile">

                <div class="user-table-avatar">
                    ${avatar}
                </div>

                <div class="user-table-name">

                    <strong>
                        ${name}
                    </strong>

                    <small>
                        ${escapeHtml(user.email || "No email")}
                    </small>

                </div>

            </div>
        </td>

        <td>
            <span class="user-phone">
                ${phone}
            </span>
        </td>

        <td>
            <strong class="balance-value">
                ${balance}
            </strong>
        </td>

        <td>
            ${status}
        </td>

        <td>
            <span class="account-badge">
                ${account}
            </span>
        </td>

        <td>
            <span class="joined-date">
                ${joined}
            </span>
        </td>

        <td>
            <button
                type="button"
                class="view-user-button"
                data-user-id="${id}"
                aria-label="View user"
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>

                <span>View</span>
            </button>
        </td>
    `;

    return row;
}


/* =========================================================
   USER MODAL
   ========================================================= */

function openUserModal(user) {

    selectedUser =
        normalizeUser(user);

    setText(
        "#modalUserName",
        selectedUser.full_name ||
        "Unknown User"
    );

    setText(
        "#modalUserEmail",
        selectedUser.email ||
        "—"
    );

    setText(
        "#modalUserPhone",
        selectedUser.phone ||
        "—"
    );

    setText(
        "#modalReferralCode",
        selectedUser.referral_code ||
        "—"
    );

    setText(
        "#modalUserBalance",
        formatCurrency(
            selectedUser.balance
        )
    );

    setText(
        "#modalUserStatus",
        capitalize(
            selectedUser.status
        )
    );

    setText(
        "#modalAccountType",
        formatAccountType(
            selectedUser.account_type,
            selectedUser.role
        )
    );

    setText(
        "#modalCreatedAt",
        formatDate(
            selectedUser.created_at
        )
    );

    const avatar =
        $("#modalUserAvatar");

    if (avatar) {

        avatar.textContent =
            (
                selectedUser.first_name ||
                selectedUser.full_name ||
                "U"
            )
                .charAt(0)
                .toUpperCase();
    }

    const modal =
        $("#userModal");

    if (modal) {

        modal.classList.add("open");

        modal.style.display = "flex";

        document.body.classList.add(
            "modal-open"
        );
    }
}


function closeUserModal() {

    const modal =
        $("#userModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.style.display = "none";

    document.body.classList.remove(
        "modal-open"
    );

    selectedUser = null;
}


/* =========================================================
   USER ACTION BUTTON
   ========================================================= */

function manageSelectedUser() {

    if (!selectedUser) {
        return;
    }

    /*
       admin-user-actions.js can take over
       management actions.

       If it is loaded, send the selected
       user to it.
    */

    if (
        window.CrownCashAdminUserActions &&
        typeof
        window.CrownCashAdminUserActions
            .openManagement === "function"
    ) {

        window.CrownCashAdminUserActions
            .openManagement(
                selectedUser
            );

        return;
    }

    showUsersMessage(
        "User management actions are not available yet.",
        "info"
    );
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("#pagination");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const totalPages =
        Math.ceil(
            filteredUsers.length /
            PAGE_SIZE
        );

    if (totalPages <= 1) {
        return;
    }

    const previous =
        document.createElement("button");

    previous.type = "button";

    previous.className =
        "pagination-button";

    previous.innerHTML = `
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
    `;

    previous.disabled =
        currentPage === 1;

    previous.addEventListener(
        "click",
        () => {

            if (currentPage > 1) {

                currentPage--;

                renderUsers();

                scrollToUsers();
            }
        }
    );

    container.appendChild(previous);


    const maxVisiblePages = 5;

    let startPage =
        Math.max(
            1,
            currentPage -
            Math.floor(
                maxVisiblePages / 2
            )
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

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "pagination-button";

        if (page === currentPage) {
            button.classList.add("active");
        }

        button.textContent =
            page;

        button.addEventListener(
            "click",
            () => {

                currentPage =
                    page;

                renderUsers();

                scrollToUsers();
            }
        );

        container.appendChild(button);
    }


    const next =
        document.createElement("button");

    next.type = "button";

    next.className =
        "pagination-button";

    next.innerHTML = `
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    `;

    next.disabled =
        currentPage === totalPages;

    next.addEventListener(
        "click",
        () => {

            if (
                currentPage <
                totalPages
            ) {

                currentPage++;

                renderUsers();

                scrollToUsers();
            }
        }
    );

    container.appendChild(next);
}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToUsers() {

    const section =
        $(".users-section");

    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        return;
    }

    const table =
        $("#usersTableBody");

    if (table) {

        table.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function showUsersLoading(show) {

    const loading =
        $("#usersLoading");

    if (loading) {

        loading.style.display =
            show ? "flex" : "none";
    }
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showUsersMessage(
    message,
    type = "info"
) {

    const element =
        $("#usersMessage");

    if (!element) {
        return;
    }

    if (!message) {

        element.textContent = "";

        element.className =
            "admin-message";

        element.style.display =
            "none";

        return;
    }

    element.textContent =
        message;

    element.className =
        `admin-message ${type}`;

    element.style.display =
        "block";
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    const sidebar =
        $("#sidebar");

    const overlay =
        $("#sidebarOverlay");

    const menuButton =
        $("#menuButton");

    const sidebarClose =
        $("#sidebarClose");


    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("open");
        }

        if (overlay) {
            overlay.classList.add("open");
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
            overlay.classList.remove("open");
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


    if (sidebarClose) {

        sidebarClose.addEventListener(
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


    $$("#sidebar a").forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <
                        1000
                    ) {

                        closeSidebar();
                    }
                }
            );
        }
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutAdmin() {

    const button =
        $("#logoutBtn");

    if (button) {
        button.disabled = true;
    }

    try {

        await fetchWithTimeout(
            LOGOUT_API,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json"
                }
            },
            8000
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


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

    const search =
        $("#searchUsers");

    if (search) {

        search.addEventListener(
            "input",
            debounce(
                applyFilters,
                250
            )
        );
    }


    const statusFilter =
        $("#statusFilter");

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const accountTypeFilter =
        $("#accountTypeFilter");

    if (accountTypeFilter) {

        accountTypeFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const refreshButton =
        $("#refreshUsersBtn");

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                refreshButton.disabled =
                    true;

                await loadUsers();

                setTimeout(
                    () => {
                        refreshButton.disabled =
                            false;
                    },
                    400
                );
            }
        );
    }


    const closeModal =
        $("#closeUserModal");

    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeUserModal
        );
    }


    const modal =
        $("#userModal");

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


    const manageButton =
        $("#manageUserBtn");

    if (manageButton) {

        manageButton.addEventListener(
            "click",
            manageSelectedUser
        );
    }


    const logoutButton =
        $("#logoutBtn");

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                logoutAdmin();
            }
        );
    }


    /*
       View buttons are delegated from
       the table so they also work after
       filtering and pagination.
    */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".view-user-button"
                );

            if (!button) {
                return;
            }

            const userId =
                button.dataset.userId;

            const user =
                allUsers.find(
                    item =>
                        String(
                            item.id ||
                            item._id ||
                            ""
                        ) ===
                        String(userId)
                );

            if (user) {

                openUserModal(
                    user
                );
            }
        }
    );
}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function numberValue(value) {

    if (
        value &&
        typeof value === "object"
    ) {

        if (
            value.$numberDecimal !==
            undefined
        ) {

            value =
                value.$numberDecimal;
        }

        if (
            value.$numberLong !==
            undefined
        ) {

            value =
                value.$numberLong;
        }
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
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
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        )
    );
}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(value) {

    return numberValue(value)
        .toLocaleString(
            "en-UG"
        );
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    try {

        if (
            typeof value === "object" &&
            value.$date
        ) {

            value =
                value.$date;
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

        return date.toLocaleDateString(
            "en-UG",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    } catch (error) {

        return "—";
    }
}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function createStatusBadge(status) {

    const safeStatus =
        String(
            status ||
            "active"
        )
            .toLowerCase();

    const label =
        capitalize(
            safeStatus
        );

    return `
        <span
            class="status-badge status-${escapeHtml(
                safeStatus
            )}"
        >
            ${escapeHtml(label)}
        </span>
    `;
}


/* =========================================================
   ACCOUNT TYPE
   ========================================================= */

function formatAccountType(
    accountType,
    role
) {

    if (
        role === "admin" ||
        accountType === "admin" ||
        accountType === "administrator"
    ) {

        return "Admin";
    }

    return "User";
}


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    const text =
        String(
            value ||
            ""
        );

    if (!text) {
        return "";
    }

    return (
        text.charAt(0)
            .toUpperCase() +
        text.slice(1)
    );
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(
        value ??
        ""
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


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
    selector,
    value
) {

    const element =
        $(selector);

    if (element) {

        element.textContent =
            value ?? "";
    }
}


/* =========================================================
   DEBOUNCE
   ========================================================= */

function debounce(
    callback,
    delay
) {

    let timer;

    return function (...args) {

        clearTimeout(timer);

        timer =
            setTimeout(
                () => {
                    callback.apply(
                        this,
                        args
                    );
                },
                delay
            );
    };
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdminUsers() {

    /*
       IMPORTANT:
       We always remove the loader.
       Even if the backend fails, the
       actual page must remain visible.
    */

    showPageLoader(
        "Loading user management"
    );

    try {

        const authenticated =
            await verifyAdmin();

        if (!authenticated) {
            return;
        }

        await loadAdminProfile();

        await loadUsers();

    } catch (error) {

        console.error(
            "Admin users initialization error:",
            error
        );

        showUsersMessage(
            "Unable to load user management. Please refresh and try again.",
            "error"
        );

    } finally {

        /*
           THIS IS THE IMPORTANT FIX.
           The loader can NEVER remain
           permanently covering the page.
        */

        hidePageLoader();
    }
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.CrownCashAdminUsers = {

    loadUsers,

    applyFilters,

    getUsers() {
        return allUsers;
    },

    getFilteredUsers() {
        return filteredUsers;
    },

    getSelectedUser() {
        return selectedUser;
    },

    openUserModal,

    closeUserModal,

    showMessage:
        showUsersMessage
};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();

        setupEvents();

        initializeAdminUsers();

    }
);