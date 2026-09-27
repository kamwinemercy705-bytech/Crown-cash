(() => {
    "use strict";

    /* =========================================================
       CROWN CASH — ADMIN USER MANAGEMENT
       ========================================================= */

    const API_BASE = "https://crown-cash1.onrender.com";

    const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
    const PROFILE_API = `${API_BASE}/profile.php`;
    const USERS_API = `${API_BASE}/admin-users.php`;
    const LOGOUT_API = `${API_BASE}/logout.php`;

    const PAGE_SIZE = 10;

    const state = {
        users: [],
        filteredUsers: [],
        currentPage: 1,
        selectedUser: null,
        admin: null,
        loading: false,
        loadError: false
    };

    /* =========================================================
       HELPERS
       ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatCurrency(value) {
        const amount = Number(value) || 0;

        return `UGX ${amount.toLocaleString("en-UG", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        })}`;
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

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
    }

    function normalizeStatus(status) {
        return String(status || "active")
            .trim()
            .toLowerCase();
    }

    function normalizeAccountType(type) {
        return String(type || "user")
            .trim()
            .toLowerCase();
    }

    function getInitials(name) {
        const cleanName = String(name || "").trim();

        if (!cleanName) {
            return "US";
        }

        const parts = cleanName
            .split(/\s+/)
            .filter(Boolean);

        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }

        return (
            parts[0].charAt(0) +
            parts[parts.length - 1].charAt(0)
        ).toUpperCase();
    }

    /* =========================================================
       USER NORMALIZATION
       ========================================================= */

    function normalizeUser(user) {
        user = user || {};

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

        let fullName = String(
            user.full_name ||
            user.fullName ||
            ""
        ).trim();

        if (!fullName) {
            fullName = [firstName, lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
        }

        /*
         * Do not use "User" as the actual name anymore.
         * This makes missing names clearly identifiable.
         */
        if (!fullName) {
            fullName = "Unnamed User";
        }

        const email = String(
            user.email ||
            user.email_address ||
            ""
        ).trim();

        const phone = String(
            user.phone ||
            user.phone_number ||
            user.mobile ||
            ""
        ).trim();

        const balance = Number(
            user.balance ??
            user.wallet_balance ??
            0
        ) || 0;

        const status = normalizeStatus(
            user.status
        );

        const accountType = normalizeAccountType(
            user.account_type ||
            user.accountType ||
            user.role
        );

        const id = String(
            user._id?.$oid ||
            user._id ||
            user.id ||
            ""
        );

        const createdAt =
            user.created_at ||
            user.createdAt ||
            user.joined_at ||
            user.date_joined ||
            "";

        return {
            ...user,
            id,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            email,
            phone,
            balance,
            status,
            account_type: accountType,
            created_at: createdAt
        };
    }

    /* =========================================================
       MESSAGE
       ========================================================= */

    function showMessage(message, type = "error") {
        const box = $("usersMessage");

        if (!box) {
            return;
        }

        box.textContent = message;
        box.className = `admin-message ${type}`;
        box.hidden = false;
    }

    function hideMessage() {
        const box = $("usersMessage");

        if (!box) {
            return;
        }

        box.hidden = true;
        box.textContent = "";
    }

    /* =========================================================
       API
       ========================================================= */

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, {
            credentials: "include",
            cache: "no-store",
            ...options,
            headers: {
                "Accept": "application/json",
                ...(options.headers || {})
            }
        });

        const text = await response.text();

        let data = {};

        try {
            data = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(
                `Invalid server response (${response.status}).`
            );
        }

        if (!response.ok) {
            const error = new Error(
                data.message ||
                `Request failed with status ${response.status}.`
            );

            error.status = response.status;
            error.data = data;

            throw error;
        }

        return data;
    }

    /* =========================================================
       ADMIN VERIFICATION
       ========================================================= */

    async function verifyAdmin() {
        try {
            const data = await fetchJSON(
                ADMIN_AUTH_API
            );

            if (
                data &&
                data.success === true &&
                data.authenticated === true &&
                data.authorized === true
            ) {
                state.admin = data.admin || null;
                return true;
            }

            return false;

        } catch (error) {
            console.error(
                "Administrator verification failed:",
                error
            );

            return false;
        }
    }

    /* =========================================================
       ADMIN PROFILE
       ========================================================= */

    async function loadAdminProfile() {
        try {
            const data = await fetchJSON(
                PROFILE_API
            );

            if (!data || data.success !== true) {
                return;
            }

            const user = data.user || {};

            const name =
                user.full_name ||
                [user.first_name, user.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                state.admin?.name ||
                "Administrator";

            const email =
                user.email ||
                state.admin?.email ||
                "";

            const adminName = $("adminName");
            const adminEmail = $("adminEmail");

            if (adminName) {
                adminName.textContent = name;
            }

            if (adminEmail) {
                adminEmail.textContent = email;
            }

        } catch (error) {
            console.warn(
                "Admin profile could not be loaded:",
                error
            );

            if (state.admin) {
                const adminName = $("adminName");
                const adminEmail = $("adminEmail");

                if (adminName) {
                    adminName.textContent =
                        state.admin.name ||
                        "Administrator";
                }

                if (adminEmail) {
                    adminEmail.textContent =
                        state.admin.email ||
                        "";
                }
            }
        }
    }

    /* =========================================================
       LOADING STATE
       ========================================================= */

    function setLoading(loading) {
        const loadingBox = $("usersLoading");
        const emptyBox = $("usersEmpty");
        const tableScroll =
            document.querySelector(".table-scroll");

        if (loadingBox) {
            loadingBox.hidden = !loading;
        }

        /*
         * Very important:
         * Never show "No users found" while loading.
         */
        if (loading) {
            if (emptyBox) {
                emptyBox.hidden = true;
            }

            if (tableScroll) {
                tableScroll.classList.remove(
                    "show-table"
                );
            }
        }
    }

    /* =========================================================
       LOAD USERS
       ========================================================= */

    async function loadUsers() {
        state.loading = true;
        state.loadError = false;

        hideMessage();
        setLoading(true);

        const tbody = $("usersTableBody");
        const emptyBox = $("usersEmpty");

        if (tbody) {
            tbody.innerHTML = "";
        }

        if (emptyBox) {
            emptyBox.hidden = true;
        }

        try {
            const data = await fetchJSON(
                USERS_API
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

            /*
             * Support the common API response shapes:
             *
             * {
             *   users: []
             * }
             *
             * or
             *
             * {
             *   data: {
             *      users: []
             *   }
             * }
             */
            let users = [];

            if (Array.isArray(data.users)) {
                users = data.users;
            } else if (
                data.data &&
                Array.isArray(data.data.users)
            ) {
                users = data.data.users;
            } else if (
                Array.isArray(data.data)
            ) {
                users = data.data;
            }

            state.users = users.map(
                normalizeUser
            );

            state.loadError = false;

            updateStats();

            /*
             * Set loading to false BEFORE rendering.
             * This is the important fix.
             */
            state.loading = false;

            setLoading(false);

            applyFilters();

        } catch (error) {
            console.error(
                "Unable to load users:",
                error
            );

            state.users = [];
            state.filteredUsers = [];
            state.currentPage = 1;

            state.loading = false;
            state.loadError = true;

            setLoading(false);

            /*
             * Never display "No users found" after
             * a network/API error.
             */
            if (tbody) {
                tbody.innerHTML = "";
            }

            if (emptyBox) {
                emptyBox.hidden = true;
            }

            const status =
                Number(error.status) || 0;

            if (status === 401) {
                showMessage(
                    "Your administrator session has expired. Please login again.",
                    "error"
                );
            } else if (status === 403) {
                showMessage(
                    "Administrator access was denied.",
                    "error"
                );
            } else {
                showMessage(
                    error.message ||
                    "Unable to load users. Check your connection and refresh the page.",
                    "error"
                );
            }

            renderPagination();
        }
    }

    /* =========================================================
       STATISTICS
       ========================================================= */

    function updateStats() {
        const users = state.users;

        const totalUsers = users.length;

        const activeUsers = users.filter(
            user =>
                user.status === "active"
        ).length;

        const blockedUsers = users.filter(
            user =>
                [
                    "blocked",
                    "suspended",
                    "disabled",
                    "banned"
                ].includes(user.status)
        ).length;

        const adminUsers = users.filter(
            user =>
                user.account_type === "admin" ||
                user.role === "admin"
        ).length;

        setText(
            "totalUsers",
            totalUsers.toLocaleString()
        );

        setText(
            "activeUsers",
            activeUsers.toLocaleString()
        );

        setText(
            "blockedUsers",
            blockedUsers.toLocaleString()
        );

        setText(
            "adminUsers",
            adminUsers.toLocaleString()
        );
    }

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    }

    /* =========================================================
       FILTERS
       ========================================================= */

    function getSearchValue() {
        const input = $("userSearch");

        return String(
            input?.value || ""
        )
            .trim()
            .toLowerCase();
    }

    function getStatusFilter() {
        return String(
            $("statusFilter")?.value ||
            "all"
        )
            .trim()
            .toLowerCase();
    }

    function getAccountFilter() {
        return String(
            $("accountTypeFilter")?.value ||
            "all"
        )
            .trim()
            .toLowerCase();
    }

    function applyFilters() {
        if (state.loading) {
            return;
        }

        if (state.loadError) {
            return;
        }

        const search =
            getSearchValue();

        const status =
            getStatusFilter();

        const accountType =
            getAccountFilter();

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

                const userIsAdmin =
                    user.account_type === "admin" ||
                    user.role === "admin";

                let matchesAccount =
                    true;

                if (accountType === "admin") {
                    matchesAccount =
                        userIsAdmin;
                } else if (
                    accountType === "user"
                ) {
                    matchesAccount =
                        !userIsAdmin;
                }

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesAccount
                );
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

        const empty =
            $("usersEmpty");

        const tableScroll =
            document.querySelector(".table-scroll");

        if (!tbody) {
            return;
        }

        /*
         * Do not render an empty state while loading.
         */
        if (state.loading) {
            tbody.innerHTML = "";

            if (empty) {
                empty.hidden = true;
            }

            if (tableScroll) {
                tableScroll.classList.remove(
                    "show-table"
                );
            }

            return;
        }

        /*
         * Do not render an empty state after an API error.
         */
        if (state.loadError) {
            tbody.innerHTML = "";

            if (empty) {
                empty.hidden = true;
            }

            if (tableScroll) {
                tableScroll.classList.remove(
                    "show-table"
                );
            }

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

        /*
         * Only NOW can "No users found"
         * legitimately appear.
         */
        if (!pageUsers.length) {
            if (empty) {
                empty.hidden = false;
            }

            if (tableScroll) {
                tableScroll.classList.remove(
                    "show-table"
                );
            }

            renderPagination();
            return;
        }

        if (empty) {
            empty.hidden = true;
        }

        if (tableScroll) {
            tableScroll.classList.add(
                "show-table"
            );
        }

        pageUsers.forEach(user => {
            const row =
                document.createElement("tr");

            const isAdmin =
                user.account_type === "admin" ||
                user.role === "admin";

            const statusClass =
                normalizeStatus(
                    user.status
                ).replace(
                    /[^a-z0-9_-]/g,
                    ""
                );

            const initials =
                getInitials(
                    user.full_name
                );

            row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <div class="user-avatar">
                            ${escapeHTML(initials)}
                        </div>

                        <div class="user-details">
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
                    <span class="phone-number">
                        ${escapeHTML(
                            user.phone ||
                            "—"
                        )}
                    </span>
                </td>

                <td>
                    <strong class="balance-value">
                        ${formatCurrency(
                            user.balance
                        )}
                    </strong>
                </td>

                <td>
                    <span class="
                        status-badge
                        ${escapeHTML(
                            statusClass
                        )}
                    ">
                        ${escapeHTML(
                            user.status
                        )}
                    </span>
                </td>

                <td>
                    <span class="
                        account-badge
                        ${isAdmin ? "admin" : "user"}
                    ">
                        ${isAdmin ? "Admin" : "User"}
                    </span>
                </td>

                <td>
                    <span class="joined-date">
                        ${formatDate(
                            user.created_at
                        )}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="view-user-button"
                        data-user-id="${escapeHTML(
                            user.id
                        )}"
                        title="View user"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>
                            <circle cx="12" cy="12" r="2.8"/>
                        </svg>

                        <span>View</span>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        renderPagination();
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

        const total =
            state.filteredUsers.length;

        const pageCount =
            Math.ceil(
                total / PAGE_SIZE
            );

        pagination.innerHTML = "";

        if (
            pageCount <= 1 ||
            state.loading ||
            state.loadError
        ) {
            return;
        }

        const previous =
            document.createElement("button");

        previous.type = "button";
        previous.className =
            "pagination-button";
        previous.textContent = "Previous";
        previous.disabled =
            state.currentPage === 1;

        previous.addEventListener(
            "click",
            () => {
                if (
                    state.currentPage > 1
                ) {
                    state.currentPage--;
                    renderUsers();
                    scrollToUsers();
                }
            }
        );

        pagination.appendChild(
            previous
        );

        for (
            let page = 1;
            page <= pageCount;
            page++
        ) {
            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "pagination-button";

            if (
                page ===
                state.currentPage
            ) {
                button.classList.add(
                    "active"
                );
            }

            button.textContent =
                String(page);

            button.addEventListener(
                "click",
                () => {
                    state.currentPage =
                        page;

                    renderUsers();
                    scrollToUsers();
                }
            );

            pagination.appendChild(
                button
            );
        }

        const next =
            document.createElement("button");

        next.type = "button";
        next.className =
            "pagination-button";
        next.textContent = "Next";

        next.disabled =
            state.currentPage >=
            pageCount;

        next.addEventListener(
            "click",
            () => {
                if (
                    state.currentPage <
                    pageCount
                ) {
                    state.currentPage++;
                    renderUsers();
                    scrollToUsers();
                }
            }
        );

        pagination.appendChild(
            next
        );
    }

    function scrollToUsers() {
        const card =
            document.querySelector(
                ".users-card"
            );

        if (!card) {
            return;
        }

        card.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    /* =========================================================
       USER MODAL
       ========================================================= */

    function openUserModal(user) {
        state.selectedUser = user;

        const modal =
            $("userModal");

        if (!modal) {
            return;
        }

        setText(
            "modalUserName",
            user.full_name
        );

        setText(
            "modalUserEmail",
            user.email ||
            "No email"
        );

        setText(
            "modalUserPhone",
            user.phone ||
            "—"
        );

        setText(
            "modalUserBalance",
            formatCurrency(
                user.balance
            )
        );

        setText(
            "modalUserStatus",
            user.status
        );

        setText(
            "modalUserAccountType",
            user.account_type === "admin"
                ? "Admin"
                : "User"
        );

        setText(
            "modalUserJoined",
            formatDate(
                user.created_at
            )
        );

        modal.hidden = false;

        document.body.classList.add(
            "modal-open"
        );
    }

    function closeUserModal() {
        const modal =
            $("userModal");

        if (modal) {
            modal.hidden = true;
        }

        document.body.classList.remove(
            "modal-open"
        );

        state.selectedUser = null;
    }

    function viewUserById(id) {
        const user =
            state.users.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!user) {
            return;
        }

        openUserModal(user);
    }

    /* =========================================================
       USER MANAGEMENT ACTIONS
       ========================================================= */

    async function performUserAction(
        action
    ) {
        const user =
            state.selectedUser;

        if (!user || !user.id) {
            return;
        }

        let message = "";

        if (action === "block") {
            message =
                "Are you sure you want to block this user?";
        } else if (
            action === "activate"
        ) {
            message =
                "Activate this user account?";
        } else if (
            action === "suspend"
        ) {
            message =
                "Suspend this user account?";
        } else if (
            action === "delete"
        ) {
            message =
                "Delete this user account? This action should only be used when you are certain.";
        }

        if (
            message &&
            !window.confirm(message)
        ) {
            return;
        }

        try {
            const response =
                await fetchJSON(
                    `${API_BASE}/admin-user-actions.php`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            user_id:
                                user.id,
                            action
                        })
                    }
                );

            if (
                !response ||
                response.success !== true
            ) {
                throw new Error(
                    response?.message ||
                    "User action failed."
                );
            }

            showMessage(
                response.message ||
                "User account updated successfully.",
                "success"
            );

            closeUserModal();

            await loadUsers();

        } catch (error) {
            console.error(
                "User action failed:",
                error
            );

            showMessage(
                error.message ||
                "Unable to update this user.",
                "error"
            );
        }
    }

    /* =========================================================
       EVENTS
       ========================================================= */

    function bindEvents() {

        const search =
            $("userSearch");

        if (search) {
            search.addEventListener(
                "input",
                () => {
                    applyFilters();
                }
            );
        }

        const status =
            $("statusFilter");

        if (status) {
            status.addEventListener(
                "change",
                () => {
                    applyFilters();
                }
            );
        }

        const accountType =
            $("accountTypeFilter");

        if (accountType) {
            accountType.addEventListener(
                "change",
                () => {
                    applyFilters();
                }
            );
        }

        const refresh =
            $("refreshUsersBtn");

        if (refresh) {
            refresh.addEventListener(
                "click",
                async () => {
                    refresh.classList.add(
                        "spinning"
                    );

                    await loadUsers();

                    setTimeout(() => {
                        refresh.classList.remove(
                            "spinning"
                        );
                    }, 500);
                }
            );
        }

        const tbody =
            $("usersTableBody");

        if (tbody) {
            tbody.addEventListener(
                "click",
                event => {
                    const button =
                        event.target.closest(
                            "[data-user-id]"
                        );

                    if (!button) {
                        return;
                    }

                    viewUserById(
                        button.dataset.userId
                    );
                }
            );
        }

        const closeModal =
            $("closeUserModal");

        if (closeModal) {
            closeModal.addEventListener(
                "click",
                closeUserModal
            );
        }

        const cancelModal =
            $("cancelUserModal");

        if (cancelModal) {
            cancelModal.addEventListener(
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
                        event.target ===
                        modal
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
                    event.key ===
                    "Escape"
                ) {
                    closeUserModal();
                }
            }
        );

        const blockButton =
            $("blockUserButton");

        if (blockButton) {
            blockButton.addEventListener(
                "click",
                () =>
                    performUserAction(
                        "block"
                    )
            );
        }

        const activateButton =
            $("activateUserButton");

        if (activateButton) {
            activateButton.addEventListener(
                "click",
                () =>
                    performUserAction(
                        "activate"
                    )
            );
        }

        const suspendButton =
            $("suspendUserButton");

        if (suspendButton) {
            suspendButton.addEventListener(
                "click",
                () =>
                    performUserAction(
                        "suspend"
                    )
            );
        }

        const deleteButton =
            $("deleteUserButton");

        if (deleteButton) {
            deleteButton.addEventListener(
                "click",
                () =>
                    performUserAction(
                        "delete"
                    )
            );
        }

        bindSidebar();
    }

    /* =========================================================
       SIDEBAR
       ========================================================= */

    function bindSidebar() {
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
                sidebar.classList.add(
                    "open"
                );
            }

            if (overlay) {
                overlay.classList.add(
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

            if (overlay) {
                overlay.classList.remove(
                    "show"
                );
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
                        closeSidebar();
                    }
                );
            });
    }

    /* =========================================================
       LOGOUT
       ========================================================= */

    async function logout() {
        try {
            await fetch(
                LOGOUT_API,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
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
       INITIALIZATION
       ========================================================= */

    async function init() {
        bindEvents();

        const authorized =
            await verifyAdmin();

        if (!authorized) {
            showMessage(
                "Administrator verification failed. Please login again.",
                "error"
            );

            const loader =
                $("pageLoader");

            if (loader) {
                setTimeout(() => {
                    loader.classList.add(
                        "hidden"
                    );
                }, 300);
            }

            return;
        }

        await loadAdminProfile();

        await loadUsers();

        const logoutButton =
            $("logoutButton");

        if (logoutButton) {
            logoutButton.addEventListener(
                "click",
                logout
            );
        }

        const loader =
            $("pageLoader");

        if (loader) {
            setTimeout(() => {
                loader.classList.add(
                    "hidden"
                );
            }, 250);
        }
    }

    /* =========================================================
       GLOBAL API
       ========================================================= */

    window.CrownCashAdminUsers = {
        reload: loadUsers,
        refresh: loadUsers,
        getUsers: () => [
            ...state.users
        ],
        getSelectedUser: () =>
            state.selectedUser,
        openUserModal,
        closeUserModal,
        applyFilters
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init
        );
    } else {