/* =========================================================
   CROWN CASH — ADMIN USER MANAGEMENT
   admin-users.js
   ========================================================= */

(() => {
    "use strict";

    const API_BASE = "https://crown-cash1.onrender.com";

    const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
    const PROFILE_API = `${API_BASE}/profile.php`;
    const USERS_API = `${API_BASE}/admin-users.php`;
    const LOGOUT_API = `${API_BASE}/logout.php`;

    const PAGE_SIZE = 10;

    let users = [];
    let filteredUsers = [];
    let currentPage = 1;
    let selectedUser = null;
    let isLoading = false;

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    const $ = (id) => document.getElementById(id);

    function showElement(id) {
        const el = $(id);

        if (!el) return;

        el.hidden = false;
        el.style.display = "";
        el.classList.remove("hidden");
    }

    function hideElement(id) {
        const el = $(id);

        if (!el) return;

        el.hidden = true;
        el.style.display = "none";
        el.classList.add("hidden");
    }

    function setText(id, value) {
        const el = $(id);

        if (el) {
            el.textContent = value ?? "";
        }
    }

    /* =========================================================
       PAGE LOADER
       ========================================================= */

    function hidePageLoader() {
        const loader = $("pageLoader");

        if (!loader) return;

        loader.classList.add("hidden");

        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        loader.style.pointerEvents = "none";

        setTimeout(() => {
            loader.style.display = "none";
        }, 250);
    }

    function showPageLoader() {
        const loader = $("pageLoader");

        if (!loader) return;

        loader.hidden = false;
        loader.classList.remove("hidden");

        loader.style.display = "flex";
        loader.style.opacity = "1";
        loader.style.visibility = "visible";
        loader.style.pointerEvents = "auto";
    }

    /* =========================================================
       MESSAGE
       ========================================================= */

    function showMessage(message, type = "info") {
        const box = $("usersMessage");

        if (!box) return;

        box.textContent = message;
        box.className = `admin-message ${type}`;
        box.style.display = "block";

        clearTimeout(showMessage.timer);

        showMessage.timer = setTimeout(() => {
            box.style.display = "none";
        }, 5000);
    }

    /* =========================================================
       NUMBER HELPERS
       ========================================================= */

    function numberValue(value) {
        if (value === null || value === undefined) {
            return 0;
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : 0;
        }

        if (typeof value === "object") {
            if (value.$numberDecimal !== undefined) {
                return Number(value.$numberDecimal) || 0;
            }

            if (value.$numberInt !== undefined) {
                return Number(value.$numberInt) || 0;
            }

            if (value.$numberLong !== undefined) {
                return Number(value.$numberLong) || 0;
            }
        }

        const cleaned = String(value)
            .replace(/,/g, "")
            .replace(/[^\d.-]/g, "");

        const result = Number(cleaned);

        return Number.isFinite(result) ? result : 0;
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("en-UG", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numberValue(value));
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        let date;

        if (typeof value === "object") {
            if (value.$date) {
                date = new Date(value.$date);
            } else {
                return "—";
            }
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat("en-UG", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    /* =========================================================
       HTML ESCAPE
       ========================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =========================================================
       ID HELPERS
       ========================================================= */

    function getUserId(user) {
        if (!user) return "";

        if (typeof user.id === "string") {
            return user.id;
        }

        if (typeof user._id === "string") {
            return user._id;
        }

        if (user._id && typeof user._id === "object") {
            if (user._id.$oid) {
                return user._id.$oid;
            }
        }

        if (user.user_id) {
            return String(user.user_id);
        }

        return "";
    }

    /* =========================================================
       USER NORMALIZATION
       ========================================================= */

    function normalizeUser(raw) {
        const user = raw || {};

        let firstName = user.first_name || user.firstName || "";
        let lastName = user.last_name || user.lastName || "";

        let fullName =
            user.full_name ||
            user.fullName ||
            `${firstName} ${lastName}`.trim();

        if (!fullName) {
            fullName = "Unknown User";
        }

        if (!firstName && fullName) {
            const parts = fullName.trim().split(/\s+/);

            firstName = parts.shift() || "";
            lastName = parts.join(" ");
        }

        const status = String(
            user.status ||
            "active"
        ).toLowerCase();

        const role = String(
            user.role ||
            ""
        ).toLowerCase();

        const accountType = String(
            user.account_type ||
            user.accountType ||
            user.account_type_name ||
            "user"
        ).toLowerCase();

        return {
            ...user,

            id: getUserId(user),

            first_name: firstName,
            last_name: lastName,
            full_name: fullName,

            email: String(user.email || ""),

            phone: String(
                user.phone ||
                user.phone_number ||
                user.mobile ||
                ""
            ),

            referral_code: String(
                user.referral_code ||
                user.referralCode ||
                ""
            ),

            balance: numberValue(
                user.balance ??
                user.wallet_balance ??
                0
            ),

            status,

            role,

            account_type: accountType,

            created_at:
                user.created_at ||
                user.createdAt ||
                ""
        };
    }

    /* =========================================================
       AUTHENTICATION
       ========================================================= */

    async function checkAdminAuthentication() {
        try {
            const response = await fetch(
                ADMIN_AUTH_API,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );

            if (response.status === 401 || response.status === 403) {
                window.location.href = "login.html";
                return false;
            }

            if (!response.ok) {
                throw new Error(
                    `Authentication failed (${response.status})`
                );
            }

            const data = await response.json();

            if (
                data.success !== true ||
                data.authenticated !== true ||
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

            showMessage(
                "Unable to verify administrator session. Please try again.",
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
            const response = await fetch(
                PROFILE_API,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (!data.success || !data.user) {
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
                fullName.split(/\s+/)[0] ||
                "Administrator";

            setText("adminName", fullName);
            setText("headerUserName", firstName);
            setText("accountName", fullName);
            setText("adminFirstName", firstName);

            setText(
                "adminEmail",
                user.email || ""
            );

            setText(
                "adminAccountType",
                "Admin Account"
            );

            setText(
                "accountAvatar",
                firstName.charAt(0).toUpperCase()
            );

            setText(
                "adminAvatar",
                firstName.charAt(0).toUpperCase()
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

        if (isLoading) {
            return;
        }

        isLoading = true;

        showUsersLoading();

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

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                window.location.href = "login.html";
                return;
            }

            const text = await response.text();

            let data;

            try {
                data = JSON.parse(text);
            } catch (error) {

                console.error(
                    "Invalid users API response:",
                    text
                );

                throw new Error(
                    "The server returned an invalid response."
                );
            }

            if (!response.ok || data.success !== true) {

                throw new Error(
                    data.message ||
                    "Unable to load users."
                );
            }

            const rawUsers =
                Array.isArray(data.users)
                    ? data.users
                    : [];

            users = rawUsers.map(normalizeUser);

            updateStatistics(data);

            applyFilters();

            hideUsersLoading();

            if (users.length === 0) {
                showUsersEmpty();
            } else {
                hideUsersEmpty();
            }

        } catch (error) {

            console.error(
                "Load users error:",
                error
            );

            users = [];
            filteredUsers = [];

            hideUsersLoading();

            showUsersEmpty(
                "Unable to load users. Please refresh and try again."
            );

            showMessage(
                error.message ||
                "Unable to load users.",
                "error"
            );

        } finally {

            isLoading = false;

            /*
             * IMPORTANT:
             * Always remove the full-screen loader.
             * This prevents the page from remaining stuck on
             * "Loading user management..."
             */
            hidePageLoader();
        }
    }

    /* =========================================================
       LOADING / EMPTY STATES
       ========================================================= */

    function showUsersLoading() {

        hideElement("usersEmpty");

        const loading = $("usersLoading");

        if (!loading) return;

        loading.hidden = false;
        loading.style.display = "block";
    }

    function hideUsersLoading() {

        const loading = $("usersLoading");

        if (!loading) return;

        loading.hidden = true;
        loading.style.display = "none";
    }

    function showUsersEmpty(message) {

        const empty = $("usersEmpty");

        if (!empty) return;

        empty.hidden = false;
        empty.style.display = "block";

        const messageElement =
            empty.querySelector(
                "[data-empty-message]"
            );

        if (messageElement && message) {
            messageElement.textContent = message;
        }
    }

    function hideUsersEmpty() {
        hideElement("usersEmpty");
    }

    /* =========================================================
       STATISTICS
       ========================================================= */

    function updateStatistics(data = {}) {

        const stats =
            data.stats ||
            data.statistics ||
            {};

        const total =
            stats.total_users ??
            data.total_users ??
            users.length;

        const active =
            stats.active_users ??
            data.active_users ??
            users.filter(
                user => user.status === "active"
            ).length;

        const blocked =
            stats.blocked_users ??
            data.blocked_users ??
            users.filter(
                user =>
                    user.status === "blocked" ||
                    user.status === "suspended" ||
                    user.status === "disabled"
            ).length;

        const admins =
            stats.admin_users ??
            data.admin_users ??
            users.filter(
                user =>
                    user.role === "admin" ||
                    user.account_type === "admin" ||
                    user.account_type === "administrator"
            ).length;

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

    function formatNumber(value) {
        return new Intl.NumberFormat(
            "en-UG"
        ).format(numberValue(value));
    }

    /* =========================================================
       FILTERS
       ========================================================= */

    function applyFilters() {

        const search =
            (
                $("searchUsers")?.value ||
                ""
            )
                .trim()
                .toLowerCase();

        const status =
            (
                $("statusFilter")?.value ||
                "all"
            )
                .toLowerCase();

        const accountType =
            (
                $("accountTypeFilter")?.value ||
                "all"
            )
                .toLowerCase();

        filteredUsers = users.filter(
            user => {

                const searchable = [
                    user.full_name,
                    user.first_name,
                    user.last_name,
                    user.email,
                    user.phone,
                    user.referral_code,
                    user.id
                ]
                    .join(" ")
                    .toLowerCase();

                if (
                    search &&
                    !searchable.includes(search)
                ) {
                    return false;
                }

                if (
                    status !== "all" &&
                    user.status !== status
                ) {
                    return false;
                }

                if (
                    accountType !== "all" &&
                    user.account_type !== accountType
                ) {
                    return false;
                }

                return true;
            }
        );

        currentPage = 1;

        renderUsers();
        renderPagination();
    }

    /* =========================================================
       RENDER USERS
       ========================================================= */

    function renderUsers() {

        const tbody =
            $("usersTableBody");

        if (!tbody) {
            return;
        }

        tbody.innerHTML = "";

        if (filteredUsers.length === 0) {

            showUsersEmpty(
                "No users match the selected filters."
            );

            return;
        }

        hideUsersEmpty();

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

        pageUsers.forEach(user => {

            const row =
                document.createElement("tr");

            const initials =
                (
                    user.full_name ||
                    "U"
                )
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map(
                        part =>
                            part.charAt(0)
                                .toUpperCase()
                    )
                    .join("");

            const statusClass =
                getStatusClass(user.status);

            const accountClass =
                getAccountClass(
                    user.account_type
                );

            row.innerHTML = `
                <td>
                    <div class="user-table-profile">

                        <div class="user-table-avatar">
                            ${escapeHTML(initials || "U")}
                        </div>

                        <div class="user-table-name">
                            <strong>
                                ${escapeHTML(
                                    user.full_name
                                )}
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
                    <span class="user-phone">
                        ${escapeHTML(
                            user.phone || "—"
                        )}
                    </span>
                </td>

                <td>
                    <strong class="user-balance">
                        UGX ${formatCurrency(
                            user.balance
                        )}
                    </strong>
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(
                            capitalize(user.status)
                        )}
                    </span>
                </td>

                <td>
                    <span class="account-badge ${accountClass}">
                        ${escapeHTML(
                            capitalize(
                                user.account_type
                            )
                        )}
                    </span>
                </td>

                <td>
                    <span class="joined-date">
                        ${escapeHTML(
                            formatDate(
                                user.created_at
                            )
                        )}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="table-action-button"
                        data-view-user="${escapeHTML(
                            user.id
                        )}"
                        aria-label="View user"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path
                                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r="3"
                            />
                        </svg>
                        <span>View</span>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    /* =========================================================
       STATUS / ACCOUNT CLASSES
       ========================================================= */

    function getStatusClass(status) {

        switch (String(status).toLowerCase()) {

            case "active":
                return "status-active";

            case "pending":
                return "status-pending";

            case "suspended":
                return "status-suspended";

            case "blocked":
                return "status-blocked";

            case "disabled":
                return "status-disabled";

            default:
                return "status-default";
        }
    }

    function getAccountClass(type) {

        const value =
            String(type).toLowerCase();

        if (
            value === "admin" ||
            value === "administrator"
        ) {
            return "account-admin";
        }

        return "account-user";
    }

    function capitalize(value) {

        if (!value) {
            return "";
        }

        return String(value)
            .charAt(0)
            .toUpperCase() +
            String(value)
                .slice(1)
                .toLowerCase();
    }

    /* =========================================================
       PAGINATION
       ========================================================= */

    function renderPagination() {

        const pagination =
            $("pagination");

        if (!pagination) {
            return;
        }

        pagination.innerHTML = "";

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

        previous.disabled =
            currentPage === 1;

        previous.innerHTML = `
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="m15 18-6-6 6-6"/>
            </svg>
        `;

        previous.addEventListener(
            "click",
            () => {

                if (currentPage > 1) {
                    currentPage--;
                    renderUsers();
                    renderPagination();
                }
            }
        );

        pagination.appendChild(previous);

        for (
            let page = 1;
            page <= totalPages;
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

            button.textContent = page;

            button.addEventListener(
                "click",
                () => {

                    currentPage = page;

                    renderUsers();
                    renderPagination();
                }
            );

            pagination.appendChild(button);
        }

        const next =
            document.createElement("button");

        next.type = "button";
        next.className =
            "pagination-button";

        next.disabled =
            currentPage === totalPages;

        next.innerHTML = `
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="m9 18 6-6-6-6"/>
            </svg>
        `;

        next.addEventListener(
            "click",
            () => {

                if (currentPage < totalPages) {
                    currentPage++;

                    renderUsers();
                    renderPagination();
                }
            }
        );

        pagination.appendChild(next);
    }

    /* =========================================================
       USER MODAL
       ========================================================= */

    function openUserModal(user) {

        selectedUser = user;

        setText(
            "modalUserName",
            user.full_name || "User"
        );

        setText(
            "modalUserEmail",
            user.email || "No email"
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
            `UGX ${formatCurrency(
                user.balance
            )}`
        );

        setText(
            "modalUserStatus",
            capitalize(user.status)
        );

        setText(
            "modalAccountType",
            capitalize(user.account_type)
        );

        setText(
            "modalCreatedAt",
            formatDate(user.created_at)
        );

        const avatar =
            $("modalUserAvatar");

        if (avatar) {

            const initials =
                user.full_name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map(
                        part =>
                            part
                                .charAt(0)
                                .toUpperCase()
                    )
                    .join("");

            avatar.textContent =
                initials || "U";
        }

        const modal =
            $("userModal");

        if (!modal) {
            return;
        }

        modal.hidden = false;
        modal.style.display = "flex";
        modal.classList.add("open");

        document.body.classList.add(
            "modal-open"
        );
    }

    function closeUserModal() {

        const modal =
            $("userModal");

        if (!modal) {
            return;
        }

        modal.classList.remove("open");

        modal.hidden = true;
        modal.style.display = "none";

        document.body.classList.remove(
            "modal-open"
        );

        selectedUser = null;
    }

    /* =========================================================
       SIDEBAR
       ========================================================= */

    function setupSidebar() {

        const sidebar =
            $("sidebar");

        const overlay =
            $("sidebarOverlay");

        const menuButton =
            $("menuButton");

        const closeButton =
            $("sidebarClose");

        if (!sidebar) {
            return;
        }

        function openSidebar() {

            sidebar.classList.add("open");

            if (overlay) {
                overlay.classList.add("show");
                overlay.style.display = "block";
            }

            document.body.classList.add(
                "sidebar-open"
            );
        }

        function closeSidebar() {

            sidebar.classList.remove("open");

            if (overlay) {
                overlay.classList.remove("show");
                overlay.style.display = "none";
            }

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

        document
            .querySelectorAll(
                ".admin-nav a"
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

    /* =========================================================
       EVENT LISTENERS
       ========================================================= */

    function setupEvents() {

        $("searchUsers")?.addEventListener(
            "input",
            applyFilters
        );

        $("statusFilter")?.addEventListener(
            "change",
            applyFilters
        );

        $("accountTypeFilter")?.addEventListener(
            "change",
            applyFilters
        );

        $("refreshUsersBtn")?.addEventListener(
            "click",
            async () => {

                const button =
                    $("refreshUsersBtn");

                if (button) {
                    button.disabled = true;
                    button.classList.add(
                        "is-loading"
                    );
                }

                await loadUsers();

                if (button) {
                    button.disabled = false;
                    button.classList.remove(
                        "is-loading"
                    );
                }
            }
        );

        $("closeUserModal")?.addEventListener(
            "click",
            closeUserModal
        );

        $("userModal")?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("userModal")
                ) {
                    closeUserModal();
                }
            }
        );

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

        $("usersTableBody")?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-view-user]"
                    );

                if (!button) {
                    return;
                }

                const userId =
                    button.dataset.viewUser;

                const user =
                    users.find(
                        item =>
                            item.id === userId
                    );

                if (user) {
                    openUserModal(user);
                }
            }
        );

        $("logoutBtn")?.addEventListener(
            "click",
            logoutAdmin
        );
    }

    /* =========================================================
       LOGOUT
       ========================================================= */

    async function logoutAdmin() {

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
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({})
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

    /* =========================================================
       START APPLICATION
       ========================================================= */

    async function init() {

        /*
         * The loader is shown initially.
         */
        showPageLoader();

        /*
         * Set up the UI immediately.
         */
        setupSidebar();
        setupEvents();

        /*
         * Always have a maximum loader duration.
         * Even if an API request gets stuck, the actual page
         * will become visible.
         */
        const loaderFailsafe =
            setTimeout(() => {

                hidePageLoader();

            }, 10000);

        try {

            const authorized =
                await checkAdminAuthentication();

            if (!authorized) {
                return;
            }

            await loadAdminProfile();

            await loadUsers();

        } catch (error) {

            console.error(
                "Admin users initialization error:",
                error
            );

            showMessage(
                "Something went wrong while loading User Management.",
                "error"
            );

        } finally {

            clearTimeout(loaderFailsafe);

            /*
             * VERY IMPORTANT:
             * No matter what happens above, the loader must
             * disappear.
             */
            hidePageLoader();
        }
    }

    /* =========================================================
       GLOBAL API
       ========================================================= */

    window.CrownCashAdminUsers = {

        loadUsers,

        applyFilters,

        openUserModal,

        closeUserModal,

        getUsers: () => users,

        getFilteredUsers: () =>
            filteredUsers,

        getSelectedUser: () =>
            selectedUser
    };

    /* =========================================================
       DOM READY
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();
    }

})();