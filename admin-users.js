/* =========================================================
   CROWN CASH — ADMIN USERS
   Complete User Management Controller
   ========================================================= */

(() => {
    "use strict";

    /* ---------------------------------------------------------
       CONFIG
    --------------------------------------------------------- */

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

    /* ---------------------------------------------------------
       STATE
    --------------------------------------------------------- */

    const state = {
        users: [],
        filteredUsers: [],
        currentPage: 1,
        selectedUser: null,
        loading: false
    };

    /* ---------------------------------------------------------
       DOM HELPERS
    --------------------------------------------------------- */

    const $ = (id) => document.getElementById(id);

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* ---------------------------------------------------------
       JSON FETCH HELPER
    --------------------------------------------------------- */

    async function request(url, options = {}) {

        const response = await fetch(url, {
            credentials: "include",
            cache: "no-store",
            ...options,
            headers: {
                "Accept": "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {})
            }
        });

        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {

            const error = new Error(
                data?.message ||
                `Request failed with status ${response.status}`
            );

            error.status = response.status;
            error.data = data;

            throw error;
        }

        return data;
    }

    /* ---------------------------------------------------------
       LOADING SCREEN
    --------------------------------------------------------- */

    function hidePageLoader() {

        const loader = $("pageLoader");

        if (!loader) return;

        loader.classList.add("hidden");

        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        loader.style.pointerEvents = "none";

        setTimeout(() => {
            loader.style.display = "none";
        }, 350);
    }

    function showPageLoader(message = "Loading user management...") {

        const loader = $("pageLoader");

        if (!loader) return;

        loader.style.display = "flex";
        loader.style.opacity = "1";
        loader.style.visibility = "visible";
        loader.style.pointerEvents = "all";

        const text =
            loader.querySelector(".loader-text") ||
            loader.querySelector("[data-loader-text]") ||
            loader.querySelector("p");

        if (text) {
            text.textContent = message;
        }
    }

    /* ---------------------------------------------------------
       PAGE ERROR
    --------------------------------------------------------- */

    function showPageError(message) {

        hidePageLoader();

        const messageBox = $("usersMessage");

        if (messageBox) {

            messageBox.innerHTML = `
                <div class="admin-message error">
                    <span class="message-icon">
                        <svg
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="9"></circle>
                            <line x1="12" y1="8" x2="12" y2="13"></line>
                            <circle cx="12" cy="16.5" r="1"></circle>
                        </svg>
                    </span>

                    <span>
                        ${escapeHTML(message)}
                    </span>

                    <button
                        type="button"
                        id="retryUsersBtn"
                        class="message-action"
                    >
                        Retry
                    </button>
                </div>
            `;

            messageBox.style.display = "block";

            const retry =
                $("retryUsersBtn");

            if (retry) {
                retry.addEventListener(
                    "click",
                    () => {
                        loadUsersPage();
                    }
                );
            }
        }
    }

    /* ---------------------------------------------------------
       ADMIN AUTHENTICATION
    --------------------------------------------------------- */

    async function verifyAdmin() {

        const data = await request(
            ADMIN_AUTH_API,
            {
                method: "GET"
            }
        );

        if (
            !data ||
            data.success !== true ||
            data.authorized !== true
        ) {

            throw new Error(
                data?.message ||
                "Administrator authorization failed."
            );
        }

        return data;
    }

    /* ---------------------------------------------------------
       PROFILE
    --------------------------------------------------------- */

    async function loadAdminProfile() {

        try {

            const data = await request(
                PROFILE_API,
                {
                    method: "GET"
                }
            );

            if (!data?.success || !data.user) {
                return;
            }

            const user = data.user;

            const firstName =
                user.first_name ||
                user.full_name?.split(" ")[0] ||
                "Administrator";

            const fullName =
                user.full_name ||
                `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                "Administrator";

            const email =
                user.email ||
                "";

            const accountType =
                user.account_type ||
                user.role ||
                "Admin Account";

            /* Header/sidebar */

            if ($("adminName")) {
                $("adminName").textContent = fullName;
            }

            if ($("headerUserName")) {
                $("headerUserName").textContent = firstName;
            }

            if ($("adminAccountType")) {
                $("adminAccountType").textContent =
                    formatAccountType(accountType);
            }

            if ($("accountName")) {
                $("accountName").textContent = fullName;
            }

            if ($("adminEmail")) {
                $("adminEmail").textContent = email;
            }

            const initials =
                getInitials(fullName);

            if ($("adminAvatar")) {
                $("adminAvatar").textContent = initials;
            }

            if ($("accountAvatar")) {
                $("accountAvatar").textContent = initials;
            }

            if ($("modalUserAvatar")) {
                $("modalUserAvatar").textContent = initials;
            }

        } catch (error) {

            /*
             * Profile failure should NOT freeze the entire
             * user-management page.
             */

            console.warn(
                "Admin profile could not be loaded:",
                error
            );
        }
    }

    /* ---------------------------------------------------------
       USERS
    --------------------------------------------------------- */

    async function fetchUsers() {

        const data = await request(
            USERS_API,
            {
                method: "GET"
            }
        );

        if (!data || data.success !== true) {

            throw new Error(
                data?.message ||
                "Unable to load users."
            );
        }

        return data;
    }

    async function loadUsersPage() {

        if (state.loading) return;

        state.loading = true;

        showPageLoader(
            "Loading user management..."
        );

        clearMessage();

        try {

            await verifyAdmin();

            await loadAdminProfile();

            const data =
                await fetchUsers();

            const users =
                Array.isArray(data.users)
                    ? data.users
                    : [];

            state.users =
                users.map(normalizeUser);

            state.filteredUsers =
                [...state.users];

            state.currentPage = 1;

            updateStatistics(data);

            applyFilters();

            hidePageLoader();

        } catch (error) {

            console.error(
                "Admin users loading error:",
                error
            );

            if (
                error.status === 401 ||
                error.status === 403
            ) {

                window.location.href =
                    "login.html";

                return;
            }

            showPageError(
                error.message ||
                "Unable to load user management. Please try again."
            );

        } finally {

            state.loading = false;
        }
    }

    /* ---------------------------------------------------------
       NORMALIZE USER
    --------------------------------------------------------- */

    function normalizeUser(user) {

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

        const balance =
            toNumber(
                user.balance ??
                user.wallet_balance ??
                0
            );

        return {
            ...user,

            id:
                user.id ||
                user._id ||
                "",

            first_name:
                firstName,

            last_name:
                lastName,

            full_name:
                fullName,

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

            balance,

            wallet_balance:
                toNumber(
                    user.wallet_balance ??
                    balance
                ),

            status:
                String(
                    user.status ||
                    "active"
                ).toLowerCase(),

            role:
                user.role ||
                "",

            account_type:
                user.account_type ||
                user.role ||
                "user",

            created_at:
                user.created_at ||
                ""
        };
    }

    /* ---------------------------------------------------------
       STATISTICS
    --------------------------------------------------------- */

    function updateStatistics(data) {

        const stats =
            data?.stats ||
            {};

        const users =
            state.users;

        const total =
            Number(
                stats.total_users ??
                users.length
            );

        const active =
            Number(
                stats.active_users ??
                users.filter(
                    user =>
                        user.status === "active"
                ).length
            );

        const blocked =
            Number(
                stats.blocked_users ??
                users.filter(
                    user =>
                        [
                            "blocked",
                            "suspended",
                            "disabled",
                            "banned"
                        ].includes(user.status)
                ).length
            );

        const admins =
            Number(
                stats.admin_users ??
                users.filter(
                    user =>
                        user.role === "admin" ||
                        user.account_type === "admin" ||
                        user.account_type === "administrator"
                ).length
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

    /* ---------------------------------------------------------
       FILTERS
    --------------------------------------------------------- */

    function applyFilters() {

        const search =
            ($("searchUsers")?.value || "")
                .trim()
                .toLowerCase();

        const status =
            ($("statusFilter")?.value || "all")
                .toLowerCase();

        const accountType =
            ($("accountTypeFilter")?.value || "all")
                .toLowerCase();

        state.filteredUsers =
            state.users.filter(user => {

                const searchable = [
                    user.full_name,
                    user.email,
                    user.phone,
                    user.referral_code,
                    user.id
                ]
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !search ||
                    searchable.includes(search);

                const matchesStatus =
                    status === "all" ||
                    user.status === status;

                const userType =
                    String(
                        user.account_type ||
                        user.role ||
                        "user"
                    ).toLowerCase();

                const matchesType =
                    accountType === "all" ||
                    userType === accountType;

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesType
                );
            });

        state.currentPage = 1;

        renderUsers();
        renderPagination();
    }

    /* ---------------------------------------------------------
       RENDER USERS
    --------------------------------------------------------- */

    function renderUsers() {

        const tbody =
            $("usersTableBody");

        const loading =
            $("usersLoading");

        const empty =
            $("usersEmpty");

        if (!tbody) return;

        if (loading) {
            loading.style.display = "none";
        }

        tbody.innerHTML = "";

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

        if (!pageUsers.length) {

            if (empty) {
                empty.style.display = "block";
            }

            return;
        }

        if (empty) {
            empty.style.display = "none";
        }

        pageUsers.forEach(user => {

            const row =
                document.createElement("tr");

            const initials =
                getInitials(
                    user.full_name
                );

            row.innerHTML = `
                <td>
                    <div class="user-table-profile">

                        <div class="user-table-avatar">
                            ${escapeHTML(initials)}
                        </div>

                        <div class="user-table-info">
                            <strong>
                                ${escapeHTML(user.full_name)}
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
                    ${escapeHTML(
                        user.phone || "—"
                    )}
                </td>

                <td>
                    <strong>
                        ${formatCurrency(
                            user.balance
                        )}
                    </strong>
                </td>

                <td>
                    ${formatAccountType(
                        user.account_type ||
                        user.role ||
                        "user"
                    )}
                </td>

                <td>
                    <span class="status-badge ${statusClass(
                        user.status
                    )}">
                        ${formatStatus(
                            user.status
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
                        class="table-action-button"
                        data-user-id="${escapeHTML(
                            user.id
                        )}"
                        aria-label="View user"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
                            <circle cx="12" cy="12" r="2.5"></circle>
                        </svg>

                        <span>View</span>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    /* ---------------------------------------------------------
       PAGINATION
    --------------------------------------------------------- */

    function renderPagination() {

        const container =
            $("pagination");

        if (!container) return;

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    state.filteredUsers.length /
                    PAGE_SIZE
                )
            );

        if (totalPages <= 1) {

            container.innerHTML = "";
            return;
        }

        let html = `
            <button
                type="button"
                class="pagination-button"
                data-page="prev"
                ${state.currentPage === 1 ? "disabled" : ""}
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

        html += `
            <button
                type="button"
                class="pagination-button"
                data-page="next"
                ${
                    state.currentPage === totalPages
                        ? "disabled"
                        : ""
                }
            >
                Next
            </button>
        `;

        container.innerHTML = html;
    }

    /* ---------------------------------------------------------
       USER MODAL
    --------------------------------------------------------- */

    function openUserModal(user) {

        state.selectedUser =
            user;

        setText(
            "modalUserName",
            user.full_name || "User"
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
                user.balance
            )
        );

        setText(
            "modalUserStatus",
            formatStatus(
                user.status
            )
        );

        setText(
            "modalAccountType",
            formatAccountType(
                user.account_type ||
                user.role ||
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
            $("modalUserAvatar");

        if (avatar) {
            avatar.textContent =
                getInitials(
                    user.full_name
                );
        }

        const modal =
            $("userModal");

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
            $("userModal");

        if (modal) {
            modal.classList.remove("open");
            modal.style.display = "none";
        }

        document.body.classList.remove(
            "modal-open"
        );

        state.selectedUser =
            null;
    }

    /* ---------------------------------------------------------
       EVENTS
    --------------------------------------------------------- */

    function setupEvents() {

        /* Search */

        const search =
            $("searchUsers");

        if (search) {
            search.addEventListener(
                "input",
                debounce(
                    applyFilters,
                    250
                )
            );
        }

        /* Status */

        const status =
            $("statusFilter");

        if (status) {
            status.addEventListener(
                "change",
                applyFilters
            );
        }

        /* Account type */

        const type =
            $("accountTypeFilter");

        if (type) {
            type.addEventListener(
                "change",
                applyFilters
            );
        }

        /* Refresh */

        const refresh =
            $("refreshUsersBtn");

        if (refresh) {

            refresh.addEventListener(
                "click",
                () => {
                    loadUsersPage();
                }
            );
        }

        /* Table */

        const table =
            $("usersTableBody");

        if (table) {

            table.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-user-id]"
                        );

                    if (!button) return;

                    const id =
                        button.dataset.userId;

                    const user =
                        state.users.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (user) {
                        openUserModal(user);
                    }
                }
            );
        }

        /* Pagination */

        const pagination =
            $("pagination");

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

                    const value =
                        button.dataset.page;

                    const totalPages =
                        Math.max(
                            1,
                            Math.ceil(
                                state.filteredUsers.length /
                                PAGE_SIZE
                            )
                        );

                    if (value === "prev") {

                        state.currentPage =
                            Math.max(
                                1,
                                state.currentPage - 1
                            );

                    } else if (
                        value === "next"
                    ) {

                        state.currentPage =
                            Math.min(
                                totalPages,
                                state.currentPage + 1
                            );

                    } else {

                        state.currentPage =
                            Number(value);
                    }

                    renderUsers();
                    renderPagination();

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });
                }
            );
        }

        /* Close modal */

        const closeModal =
            $("closeUserModal");

        if (closeModal) {
            closeModal.addEventListener(
                "click",
                closeUserModal
            );
        }

        /* Click outside modal */

        const modal =
            $("userModal");

        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {
                        closeUserModal();
                    }
                }
            );
        }

        /* Escape */

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

        /* Manage user */

        const manageButton =
            $("manageUserBtn");

        if (manageButton) {

            manageButton.addEventListener(
                "click",
                () => {

                    if (
                        !state.selectedUser
                    ) {
                        showMessage(
                            "Please select a user first.",
                            "error"
                        );
                        return;
                    }

                    /*
                     * admin-user-actions.js can
                     * take over from here.
                     */

                    if (
                        window.CrownCashAdminUserActions &&
                        typeof window
                            .CrownCashAdminUserActions
                            .open === "function"
                    ) {

                        window
                            .CrownCashAdminUserActions
                            .open(
                                state.selectedUser
                            );

                    } else {

                        showMessage(
                            "User management controls are not available yet.",
                            "error"
                        );
                    }
                }
            );
        }

        /* Sidebar */

        setupSidebar();

        /* Logout */

        const logout =
            $("logoutBtn");

        if (logout) {

            logout.addEventListener(
                "click",
                logoutAdmin
            );
        }
    }

    /* ---------------------------------------------------------
       SIDEBAR
    --------------------------------------------------------- */

    function setupSidebar() {

        const sidebar =
            $("sidebar");

        const overlay =
            $("sidebarOverlay");

        const menu =
            $("menuButton");

        const close =
            $("sidebarClose");

        function openSidebar() {

            if (sidebar) {
                sidebar.classList.add(
                    "open"
                );
            }

            if (overlay) {
                overlay.classList.add(
                    "open"
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

            if (overlay) {
                overlay.classList.remove(
                    "open"
                );
            }

            document.body.classList.remove(
                "sidebar-open"
            );
        }

        if (menu) {
            menu.addEventListener(
                "click",
                openSidebar
            );
        }

        if (close) {
            close.addEventListener(
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
    }

    /* ---------------------------------------------------------
       LOGOUT
    --------------------------------------------------------- */

    async function logoutAdmin() {

        const button =
            $("logoutBtn");

        if (button) {
            button.disabled = true;
        }

        try {

            await request(
                LOGOUT_API,
                {
                    method: "GET"
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

    /* ---------------------------------------------------------
       MESSAGE
    --------------------------------------------------------- */

    function showMessage(
        message,
        type = "info"
    ) {

        const box =
            $("usersMessage");

        if (!box) return;

        box.innerHTML = `
            <div class="admin-message ${escapeHTML(type)}">
                ${escapeHTML(message)}
            </div>
        `;

        box.style.display =
            "block";
    }

    function clearMessage() {

        const box =
            $("usersMessage");

        if (!box) return;

        box.innerHTML = "";
        box.style.display = "none";
    }

    /* ---------------------------------------------------------
       FORMATTING
    --------------------------------------------------------- */

    function toNumber(value) {

        if (
            value &&
            typeof value === "object"
        ) {

            if (
                typeof value.$numberDecimal !==
                "undefined"
            ) {
                return Number(
                    value.$numberDecimal
                );
            }

            if (
                typeof value.toString ===
                "function"
            ) {
                return Number(
                    value.toString()
                );
            }
        }

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    function formatCurrency(value) {

        const amount =
            toNumber(value);

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

        let date;

        try {

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

    function formatStatus(status) {

        const value =
            String(
                status ||
                "active"
            )
                .replace(/[_-]/g, " ")
                .trim();

        return value
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            );
    }

    function formatAccountType(type) {

        const value =
            String(
                type ||
                "user"
            )
                .replace(/[_-]/g, " ")
                .trim();

        return value
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            );
    }

    function statusClass(status) {

        switch (
            String(status)
                .toLowerCase()
        ) {

            case "active":
                return "success";

            case "pending":
                return "warning";

            case "blocked":
            case "suspended":
            case "disabled":
            case "banned":
                return "danger";

            case "inactive":
                return "muted";

            default:
                return "info";
        }
    }

    function getInitials(name) {

        const parts =
            String(
                name ||
                "Administrator"
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {
            return "A";
        }

        if (parts.length === 1) {
            return parts[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }

    function setText(id, value) {

        const element =
            $(id);

        if (element) {
            element.textContent =
                value ?? "";
        }
    }

    function debounce(
        callback,
        delay
    ) {

        let timeout;

        return function (...args) {

            clearTimeout(timeout);

            timeout =
                setTimeout(
                    () => callback(...args),
                    delay
                );
        };
    }

    /* ---------------------------------------------------------
       PUBLIC API
    --------------------------------------------------------- */

    window.CrownCashAdminUsers = {

        loadUsers:
            loadUsersPage,

        getUsers:
            () => state.users,

        getSelectedUser:
            () => state.selectedUser,

        refresh:
            loadUsersPage,

        openUserModal,

        closeUserModal
    };

    /* ---------------------------------------------------------
       INITIALIZE
    --------------------------------------------------------- */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupEvents();

            /*
             * Safety timeout.
             *
             * Even if an unexpected JavaScript/API
             * problem happens, the page will not remain
             * on the loading screen forever.
             */

            const safetyTimer =
                setTimeout(
                    () => {

                        const loader =
                            $("pageLoader");

                        if (
                            loader &&
                            !loader.classList.contains(
                                "hidden"
                            )
                        ) {

                            showPageError(
                                "User management took too long to load. Please check your connection and try again."
                            );
                        }

                    },
                    15000
                );

            loadUsersPage()
                .finally(() => {
                    clearTimeout(
                        safetyTimer
                    );
                });
        }
    );

})();