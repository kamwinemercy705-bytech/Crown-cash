/* =========================================================
   CROWN CASH ADMIN USERS
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       CONFIG
    ====================================================== */

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


    /* =====================================================
       STATE
    ====================================================== */

    const state = {

        users: [],

        filteredUsers: [],

        currentPage: 1,

        selectedUser: null,

        admin: null,

        loading: false

    };


    /* =====================================================
       DOM
    ====================================================== */

    const $ = (id) =>
        document.getElementById(id);


    /* =====================================================
       HELPERS
    ====================================================== */

    function getInitials(name) {

        const value =
            String(name || "")
                .trim();

        if (!value) {
            return "U";
        }

        const parts =
            value
                .split(/\s+/)
                .filter(Boolean);

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


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function numberValue(value) {

        if (
            value &&
            typeof value === "object"
        ) {

            if (
                typeof value.$numberDecimal !==
                "undefined"
            ) {
                return (
                    parseFloat(
                        value.$numberDecimal
                    ) || 0
                );
            }

            if (
                typeof value.$numberLong !==
                "undefined"
            ) {
                return (
                    parseFloat(
                        value.$numberLong
                    ) || 0
                );
            }
        }

        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
            : 0;
    }


    function formatMoney(value) {

        return (
            "UGX " +
            numberValue(value)
                .toLocaleString(
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

            } else if (
                typeof value === "object" &&
                value.date
            ) {

                date =
                    new Date(
                        value.date
                    );

            } else {

                date =
                    new Date(value);
            }

        } catch (error) {

            return "—";
        }

        if (
            !date ||
            Number.isNaN(date.getTime())
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


    function normalizeUser(user) {

        const fullName =
            String(
                user.full_name ||
                [
                    user.first_name,
                    user.last_name
                ]
                    .filter(Boolean)
                    .join(" ") ||
                "User"
            ).trim();

        const accountType =
            String(
                user.account_type ||
                user.role ||
                "user"
            ).toLowerCase();

        const status =
            String(
                user.status ||
                "active"
            ).toLowerCase();

        return {

            ...user,

            id:
                String(
                    user.id ||
                    user._id ||
                    ""
                ),

            full_name:
                fullName,

            email:
                String(
                    user.email || ""
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

            status,

            account_type:
                accountType,

            created_at:
                user.created_at ||
                user.createdAt ||
                ""

        };
    }


    /* =====================================================
       MESSAGE
    ====================================================== */

    function showMessage(
        message,
        type = ""
    ) {

        const box =
            $("usersMessage");

        if (!box) {
            return;
        }

        box.hidden = false;

        box.textContent =
            message;

        box.className =
            "admin-message " +
            type;

    }


    function hideMessage() {

        const box =
            $("usersMessage");

        if (!box) {
            return;
        }

        box.hidden = true;

        box.textContent = "";

    }


    /* =====================================================
       ADMIN AUTHENTICATION
    ====================================================== */

    async function verifyAdmin() {

        try {

            const response =
                await fetch(
                    ADMIN_AUTH_API,
                    {
                        method: "GET",

                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache: "no-store"
                    }
                );

            const data =
                await response
                    .json()
                    .catch(() => ({}));


            /*
             * The important part:
             *
             * Do NOT destroy the user's session here.
             * If the backend says authenticated + authorized,
             * continue normally.
             */

            if (
                response.ok &&
                data.success === true &&
                (
                    data.authorized === true ||
                    data.authenticated === true
                )
            ) {

                return true;
            }


            /*
             * Some versions of admin-auth.php return:
             *
             * {
             *   success: true,
             *   authenticated: true,
             *   authorized: true
             * }
             *
             * Others may return simply success.
             */

            if (
                response.ok &&
                data.success === true &&
                data.message
            ) {

                const message =
                    String(data.message)
                        .toLowerCase();

                if (
                    message.includes("confirmed") ||
                    message.includes("administrator") ||
                    message.includes("authorized")
                ) {
                    return true;
                }
            }


            return false;

        } catch (error) {

            console.error(
                "Admin verification error:",
                error
            );

            return false;
        }
    }


    /* =====================================================
       PROFILE
    ====================================================== */

    async function loadAdminProfile() {

        try {

            const response =
                await fetch(
                    PROFILE_API,
                    {
                        method: "GET",

                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                return;
            }

            const data =
                await response
                    .json()
                    .catch(() => null);

            if (
                !data ||
                data.success !== true ||
                !data.user
            ) {
                return;
            }

            state.admin =
                data.user;


            const name =
                data.user.full_name ||
                [
                    data.user.first_name,
                    data.user.last_name
                ]
                    .filter(Boolean)
                    .join(" ") ||
                "Administrator";


            const initials =
                getInitials(name);


            if ($("adminName")) {
                $("adminName")
                    .textContent =
                    name;
            }

            if ($("headerUserName")) {
                $("headerUserName")
                    .textContent =
                    name;
            }

            if ($("adminAvatar")) {
                $("adminAvatar")
                    .textContent =
                    initials;
            }

            if ($("accountAvatar")) {
                $("accountAvatar")
                    .textContent =
                    initials;
            }

            if ($("adminAccountType")) {

                $("adminAccountType")
                    .textContent =
                    "Admin Account";

            }

        } catch (error) {

            console.warn(
                "Profile loading failed:",
                error
            );

        }
    }


    /* =====================================================
       LOAD USERS
    ====================================================== */

    async function loadUsers() {

        if (state.loading) {
            return;
        }

        state.loading = true;

        setLoading(true);

        hideMessage();


        try {

            const response =
                await fetch(
                    USERS_API,
                    {
                        method: "GET",

                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache: "no-store"
                    }
                );


            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                /*
                 * Do not instantly redirect.
                 *
                 * Show the actual backend error so
                 * we can see exactly what is wrong.
                 */

                showMessage(
                    data.message ||
                    "Administrator verification failed.",
                    "error"
                );

                state.users = [];

                applyFilters();

                return;
            }


            if (
                !response.ok ||
                data.success !== true
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load users."
                );

            }


            const rawUsers =
                Array.isArray(data.users)
                    ? data.users
                    : [];


            state.users =
                rawUsers.map(
                    normalizeUser
                );


            updateStatistics(
                data
            );


            applyFilters();


        } catch (error) {

            console.error(
                "Users loading error:",
                error
            );

            state.users = [];

            applyFilters();

            showMessage(
                error.message ||
                "Unable to load users.",
                "error"
            );

        } finally {

            state.loading = false;

            setLoading(false);

        }

    }


    /* =====================================================
       LOADING STATE
    ====================================================== */

    function setLoading(loading) {

        const loadingBox =
            $("usersLoading");

        if (loadingBox) {

            loadingBox.style.display =
                loading
                    ? "flex"
                    : "none";

        }
    }


    /* =====================================================
       STATISTICS
    ====================================================== */

    function updateStatistics(data) {

        const stats =
            data.stats ||
            data.statistics ||
            {};


        const total =
            stats.total_users ??
            data.total_users ??
            state.users.length;


        const active =
            stats.active_users ??
            data.active_users ??
            state.users.filter(
                user =>
                    user.status ===
                    "active"
            ).length;


        const blocked =
            stats.blocked_users ??
            data.blocked_users ??
            state.users.filter(
                user =>
                    user.status ===
                    "blocked"
            ).length;


        const admins =
            stats.admin_users ??
            data.admin_users ??
            state.users.filter(
                user =>
                    user.account_type ===
                        "admin" ||
                    user.account_type ===
                        "administrator" ||
                    user.role === "admin"
            ).length;


        if ($("totalUsers")) {
            $("totalUsers")
                .textContent =
                numberValue(total)
                    .toLocaleString();
        }

        if ($("activeUsers")) {
            $("activeUsers")
                .textContent =
                numberValue(active)
                    .toLocaleString();
        }

        if ($("blockedUsers")) {
            $("blockedUsers")
                .textContent =
                numberValue(blocked)
                    .toLocaleString();
        }

        if ($("adminUsers")) {
            $("adminUsers")
                .textContent =
                numberValue(admins)
                    .toLocaleString();
        }

    }


    /* =====================================================
       FILTERS
    ====================================================== */

    function applyFilters() {

        const search =
            String(
                $("searchUsers")?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const status =
            String(
                $("statusFilter")?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const accountType =
            String(
                $("accountTypeFilter")?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        state.filteredUsers =
            state.users.filter(
                user => {

                    const searchable = [
                        user.full_name,
                        user.email,
                        user.phone,
                        user.referral_code
                    ]
                        .join(" ")
                        .toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const matchesStatus =
                        !status ||
                        user.status ===
                        status;


                    let matchesAccount =
                        true;


                    if (accountType) {

                        if (
                            accountType ===
                            "admin"
                        ) {

                            matchesAccount =
                                user.account_type ===
                                    "admin" ||
                                user.account_type ===
                                    "administrator" ||
                                user.role ===
                                    "admin";

                        } else {

                            matchesAccount =
                                user.account_type ===
                                accountType;

                        }

                    }


                    return (
                        matchesSearch &&
                        matchesStatus &&
                        matchesAccount
                    );

                }
            );


        state.currentPage = 1;

        renderUsers();

    }


    /* =====================================================
       RENDER USERS
    ====================================================== */

    function renderUsers() {

        const tbody =
            $("usersTableBody");

        const empty =
            $("usersEmpty");

        if (!tbody) {
            return;
        }


        tbody.innerHTML = "";


        const total =
            state.filteredUsers.length;


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
                empty.hidden = false;
            }

            renderPagination();

            return;

        }


        if (empty) {
            empty.hidden = true;
        }


        pageUsers.forEach(
            user => {

                const row =
                    document.createElement(
                        "tr"
                    );


                const initials =
                    getInitials(
                        user.full_name
                    );


                const statusClass =
                    `status-${escapeHTML(
                        user.status
                    )}`;


                const isAdmin =
                    user.account_type ===
                        "admin" ||
                    user.account_type ===
                        "administrator" ||
                    user.role === "admin";


                const accountClass =
                    isAdmin
                        ? "account-admin"
                        : "account-user";


                const accountText =
                    isAdmin
                        ? "Admin"
                        : "User";


                row.innerHTML = `

                    <td>

                        <div class="user-cell">

                            <div class="user-avatar">
                                ${escapeHTML(initials)}
                            </div>

                            <div class="user-name">

                                <strong>
                                    ${escapeHTML(
                                        user.full_name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        user.email ||
                                        "No email"
                                    )}
                                </span>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${escapeHTML(
                            user.phone ||
                            "—"
                        )}
                    </td>


                    <td class="balance">
                        ${escapeHTML(
                            formatMoney(
                                user.balance
                            )
                        )}
                    </td>


                    <td>

                        <span class="
                            status-badge
                            ${statusClass}
                        ">
                            ${escapeHTML(
                                user.status
                            )}
                        </span>

                    </td>


                    <td>

                        <span class="
                            account-badge
                            ${accountClass}
                        ">
                            ${accountText}
                        </span>

                    </td>


                    <td>
                        ${escapeHTML(
                            formatDate(
                                user.created_at
                            )
                        )}
                    </td>


                    <td>

                        <button
                            class="view-button"
                            type="button"
                            data-user-id="${escapeHTML(
                                user.id
                            )}"
                            aria-label="View user"
                        >

                            <svg viewBox="0 0 24 24">
                                <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6z"/>
                                <circle cx="12" cy="12" r="2.5"/>
                            </svg>

                        </button>

                    </td>

                `;


                tbody.appendChild(row);

            }
        );


        renderPagination();

    }


    /* =====================================================
       PAGINATION
    ====================================================== */

    function renderPagination() {

        const container =
            $("pagination");

        if (!container) {
            return;
        }


        container.innerHTML = "";


        const totalPages =
            Math.ceil(
                state.filteredUsers.length /
                PAGE_SIZE
            );


        if (totalPages <= 1) {
            return;
        }


        const previous =
            document.createElement(
                "button"
            );

        previous.type = "button";

        previous.textContent = "‹";

        previous.disabled =
            state.currentPage <= 1;


        previous.addEventListener(
            "click",
            () => {

                if (
                    state.currentPage >
                    1
                ) {

                    state.currentPage--;

                    renderUsers();

                }

            }
        );


        container.appendChild(
            previous
        );


        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.textContent =
                page;


            if (
                page ===
                state.currentPage
            ) {

                button.classList.add(
                    "active"
                );

            }


            button.addEventListener(
                "click",
                () => {

                    state.currentPage =
                        page;

                    renderUsers();

                }
            );


            container.appendChild(
                button
            );

        }


        const next =
            document.createElement(
                "button"
            );

        next.type = "button";

        next.textContent = "›";

        next.disabled =
            state.currentPage >=
            totalPages;


        next.addEventListener(
            "click",
            () => {

                if (
                    state.currentPage <
                    totalPages
                ) {

                    state.currentPage++;

                    renderUsers();

                }

            }
        );


        container.appendChild(
            next
        );

    }


    /* =====================================================
       OPEN USER MODAL
    ====================================================== */

    function openUserModal(user) {

        if (!user) {
            return;
        }


        state.selectedUser =
            user;


        const modal =
            $("userModal");


        if (!modal) {
            return;
        }


        const initials =
            getInitials(
                user.full_name
            );


        $("modalUserAvatar")
            .textContent =
            initials;


        $("modalUserName")
            .textContent =
            user.full_name ||
            "User";


        $("modalUserEmail")
            .textContent =
            user.email ||
            "No email";


        $("modalUserPhone")
            .textContent =
            user.phone ||
            "—";


        $("modalReferralCode")
            .textContent =
            user.referral_code ||
            "—";


        $("modalUserBalance")
            .textContent =
            formatMoney(
                user.balance
            );


        $("modalUserStatus")
            .textContent =
            user.status ||
            "—";


        $("modalAccountType")
            .textContent =
            user.account_type ||
            "user";


        $("modalCreatedAt")
            .textContent =
            formatDate(
                user.created_at
            );


        const management =
            $("userManagementPanel");

        if (management) {
            management.innerHTML = "";
        }


        modal.hidden = false;

        document.body.style.overflow =
            "hidden";

    }


    /* =====================================================
       CLOSE MODAL
    ====================================================== */

    function closeUserModal() {

        const modal =
            $("userModal");

        if (!modal) {
            return;
        }

        modal.hidden = true;

        document.body.style.overflow =
            "";

        state.selectedUser =
            null;

    }


    /* =====================================================
       MANAGEMENT BUTTON
    ====================================================== */

    function manageSelectedUser() {

        const user =
            state.selectedUser;


        if (!user) {
            return;
        }


        const panel =
            $("userManagementPanel");


        if (!panel) {
            return;
        }


        const status =
            user.status;


        const actions = [];


        if (
            status ===
                "blocked" ||
            status ===
                "suspended" ||
            status ===
                "disabled"
        ) {

            actions.push({
                action: "activate",
                label: "Activate",
                className: "management-green"
            });

            actions.push({
                action: "restore",
                label: "Restore",
                className: "management-gold"
            });

        } else {

            actions.push({
                action: "suspend",
                label: "Suspend",
                className: "management-orange"
            });

            actions.push({
                action: "block",
                label: "Block",
                className: "management-red"
            });

            actions.push({
                action: "disable",
                label: "Disable",
                className: "management-purple"
            });

        }


        panel.innerHTML = `

            <div style="
                display:grid;
                grid-template-columns:
                    repeat(${Math.min(
                        actions.length,
                        3
                    )}, minmax(0,1fr));
                gap:7px;
                margin-top:8px;
            ">

                ${actions.map(
                    item => `

                    <button
                        type="button"
                        data-user-action="${item.action}"
                        style="
                            min-height:34px;
                            border:1px solid rgba(255,255,255,.08);
                            border-radius:9px;
                            color:#eee;
                            background:rgba(255,255,255,.035);
                            font-size:9px;
                            font-weight:700;
                        "
                    >
                        ${item.label}
                    </button>

                `
                ).join("")}

            </div>

        `;

    }


    /* =====================================================
       USER ACTION
    ====================================================== */

    async function performUserAction(
        action
    ) {

        const user =
            state.selectedUser;


        if (
            !user ||
            !user.id
        ) {
            return;
        }


        const labels = {

            activate: "activate",

            restore: "restore",

            suspend: "suspend",

            block: "block",

            disable: "disable"

        };


        const label =
            labels[action] ||
            action;


        const confirmed =
            window.confirm(
                `Are you sure you want to ${label} ${user.full_name}?`
            );


        if (!confirmed) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_BASE}/admin-user-actions.php`,
                    {
                        method: "POST",

                        credentials: "include",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                user_id:
                                    user.id,

                                action
                            })
                    }
                );


            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (
                response.status ===
                    401 ||
                response.status ===
                    403
            ) {

                showMessage(
                    data.message ||
                    "Administrator access is required.",
                    "error"
                );

                return;
            }


            if (
                !response.ok ||
                data.success !== true
            ) {

                throw new Error(
                    data.message ||
                    "User action failed."
                );

            }


            showMessage(
                data.message ||
                "User account updated successfully.",
                "success"
            );


            closeUserModal();

            await loadUsers();


        } catch (error) {

            console.error(
                "User action error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to update user.",
                "error"
            );

        }

    }


    /* =====================================================
       SIDEBAR
    ====================================================== */

    function openSidebar() {

        $("sidebar")?.classList.add(
            "open"
        );

        $("sidebarOverlay")?.classList.add(
            "show"
        );

    }


    function closeSidebar() {

        $("sidebar")?.classList.remove(
            "open"
        );

        $("sidebarOverlay")?.classList.remove(
            "show"
        );

    }


    /* =====================================================
       LOGOUT
    ====================================================== */

    async function logout() {

        try {

            await fetch(
                LOGOUT_API,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Accept":
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


    /* =====================================================
       EVENTS
    ====================================================== */

    function bindEvents() {

        $("searchUsers")
            ?.addEventListener(
                "input",
                applyFilters
            );


        $("statusFilter")
            ?.addEventListener(
                "change",
                applyFilters
            );


        $("accountTypeFilter")
            ?.addEventListener(
                "change",
                applyFilters
            );


        $("refreshUsersBtn")
            ?.addEventListener(
                "click",
                loadUsers
            );


        $("closeUserModal")
            ?.addEventListener(
                "click",
                closeUserModal
            );


        $("userModal")
            ?.addEventListener(
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


        $("manageUserBtn")
            ?.addEventListener(
                "click",
                manageSelectedUser
            );


        $("usersTableBody")
            ?.addEventListener(
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
                        state.users.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(id)
                        );


                    openUserModal(
                        user
                    );

                }
            );


        $("userManagementPanel")
            ?.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            "[data-user-action]"
                        );


                    if (!button) {
                        return;
                    }


                    performUserAction(
                        button.dataset.userAction
                    );

                }
            );


        $("menuButton")
            ?.addEventListener(
                "click",
                openSidebar
            );


        $("sidebarClose")
            ?.addEventListener(
                "click",
                closeSidebar
            );


        $("sidebarOverlay")
            ?.addEventListener(
                "click",
                closeSidebar
            );


        $("logoutBtn")
            ?.addEventListener(
                "click",
                logout
            );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeUserModal();

                    closeSidebar();

                }

            }
        );

    }


    /* =====================================================
       START
    ====================================================== */

    async function init() {

        bindEvents();


        /*
         * Do not redirect to login merely because
         * admin-auth.php temporarily gives an unexpected
         * response. First display the page and show the
         * actual verification problem.
         */

        const verified =
            await verifyAdmin();


        if (!verified) {

            showMessage(
                "Administrator verification failed. Please refresh the page and try again.",
                "error"
            );

        }


        await loadAdminProfile();

        await loadUsers();


        setTimeout(
            () => {

                $("pageLoader")
                    ?.classList.add(
                        "hidden"
                    );

            },
            250
        );

    }


    /* =====================================================
       GLOBAL API
    ====================================================== */

    window.CrownCashAdminUsers = {

        loadUsers,

        applyFilters,

        openUserModal,

        closeUserModal,

        getSelectedUser:
            () =>
                state.selectedUser,

        getUsers:
            () =>
                state.users

    };


    document.addEventListener(
        "DOMContentLoaded",
        init
    );

})();