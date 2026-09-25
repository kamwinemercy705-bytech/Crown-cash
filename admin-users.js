/* =========================================================
   CROWN CASH ADMIN — USER MANAGEMENT
   admin-users.js
   ========================================================= */

"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const PROFILE_API = `${API_BASE}/profile.php`;
const USERS_API = `${API_BASE}/admin-users.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;

const PAGE_SIZE = 10;

let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
let selectedUser = null;
let isLoadingUsers = false;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function showElement(element) {
    if (!element) return;

    element.classList.remove("hidden");

    if (element.style.display === "none") {
        element.style.display = "";
    }
}

function hideElement(element) {
    if (!element) return;

    element.classList.add("hidden");
    element.style.display = "none";
}


/* =========================================================
   LOADER
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
    }, 350);
}


function showPageLoader() {
    const loader = $("pageLoader");

    if (!loader) return;

    loader.classList.remove("hidden");

    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.visibility = "visible";
    loader.style.pointerEvents = "auto";
}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(url, options = {}, timeout = 12000) {

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {

        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        return response;

    } finally {

        clearTimeout(timeoutId);

    }
}


/* =========================================================
   JSON RESPONSE HELPER
   ========================================================= */

async function readJSON(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error("Invalid JSON response:", text);

        throw new Error("The server returned an invalid response.");

    }
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function verifyAdmin() {

    try {

        const response = await fetchWithTimeout(
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

        const data = await readJSON(response);

        console.log("Admin authentication:", data);

        if (
            response.ok &&
            data.success === true &&
            data.authenticated === true &&
            data.authorized === true
        ) {
            return true;
        }

        if (response.status === 401 || response.status === 403) {

            window.location.href = "login.html";

            return false;
        }

        throw new Error(
            data.message ||
            "Administrator authentication failed."
        );

    } catch (error) {

        console.error("Admin authentication error:", error);

        /*
         * Important:
         * Do NOT leave the loading screen running forever.
         */

        hidePageLoader();

        showUsersMessage(
            error.name === "AbortError"
                ? "Administrator verification timed out. Please refresh and try again."
                : (
                    error.message ||
                    "Unable to verify administrator session."
                ),
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

        const response = await fetchWithTimeout(
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

        const data = await readJSON(response);

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message ||
                "Unable to load administrator profile."
            );
        }

        const user = data.user || {};

        const firstName =
            user.first_name ||
            user.firstName ||
            "Administrator";

        const fullName =
            user.full_name ||
            user.fullName ||
            firstName;

        const email =
            user.email ||
            "";

        const accountType =
            user.account_type ||
            user.accountType ||
            "Admin Account";


        setText("adminName", fullName);
        setText("headerUserName", fullName);
        setText("accountName", fullName);

        setText("adminFirstName", firstName);

        setText("adminEmail", email);

        setText(
            "adminAccountType",
            accountType
        );


        const avatarLetter =
            String(firstName)
                .trim()
                .charAt(0)
                .toUpperCase() || "A";

        setText("adminAvatar", avatarLetter);
        setText("accountAvatar", avatarLetter);

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );

        /*
         * Profile failure should NOT freeze the page.
         */

        setText("adminName", "Administrator");
        setText("headerUserName", "Administrator");
        setText("accountName", "Administrator");
        setText("adminFirstName", "Administrator");
        setText("adminAccountType", "Admin Account");
        setText("adminAvatar", "A");
        setText("accountAvatar", "A");
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

    showUsersLoading();

    try {

        const response = await fetchWithTimeout(
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

        const data = await readJSON(response);

        console.log("Users API response:", data);

        if (response.status === 401 || response.status === 403) {

            window.location.href = "login.html";

            return;
        }

        if (!response.ok || data.success !== true) {

            throw new Error(
                data.message ||
                "Unable to load users."
            );
        }


        /*
         * Accept several possible backend formats.
         */

        let users = [];

        if (Array.isArray(data.users)) {
            users = data.users;
        } else if (Array.isArray(data.data)) {
            users = data.data;
        } else if (Array.isArray(data.results)) {
            users = data.results;
        }


        allUsers = users.map(normalizeUser);

        filteredUsers = [...allUsers];

        currentPage = 1;


        /*
         * Update statistics.
         */

        updateStatistics(data, allUsers);


        /*
         * Apply filters.
         */

        applyFilters(false);


        hideUsersLoading();


        if (allUsers.length === 0) {

            showUsersEmpty();

        } else {

            hideUsersEmpty();

        }

    } catch (error) {

        console.error("Users loading error:", error);

        allUsers = [];
        filteredUsers = [];

        renderUsers([]);

        showUsersEmpty();

        showUsersMessage(
            error.name === "AbortError"
                ? "Loading users timed out. Please try again."
                : (
                    error.message ||
                    "Unable to load registered users."
                ),
            "error"
        );

    } finally {

        isLoadingUsers = false;

        hideUsersLoading();

        /*
         * Critical fix:
         * Never leave pageLoader covering the page.
         */

        hidePageLoader();
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
        user.firstName ||
        "";

    const lastName =
        user.last_name ||
        user.lastName ||
        "";

    const fullName =
        user.full_name ||
        user.fullName ||
        `${firstName} ${lastName}`.trim() ||
        "Unknown User";

    const id =
        user.id ||
        user._id ||
        user.user_id ||
        user.userId ||
        "";


    return {

        ...user,

        id: mongoId(id),

        first_name: firstName,

        last_name: lastName,

        full_name: fullName,

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
            user.referralCode ||
            "",

        balance:
            toNumber(
                user.balance ??
                user.wallet_balance ??
                user.walletBalance ??
                0
            ),

        wallet_balance:
            toNumber(
                user.wallet_balance ??
                user.balance ??
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
                user.accountType ||
                "user"
            ).toLowerCase(),

        created_at:
            user.created_at ||
            user.createdAt ||
            null

    };
}


/* =========================================================
   MONGODB ID
   ========================================================= */

function mongoId(value) {

    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "object") {

        if (value.$oid) {
            return String(value.$oid);
        }

        if (value.oid) {
            return String(value.oid);
        }

        if (value.toString) {

            const result = value.toString();

            if (result !== "[object Object]") {
                return result;
            }
        }
    }

    return String(value);
}


/* =========================================================
   NUMBER HELPER
   ========================================================= */

function toNumber(value) {

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

    const number = Number(
        String(value).replace(/,/g, "")
    );

    return Number.isFinite(number)
        ? number
        : 0;
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics(data, users) {

    const stats = data.stats || data.statistics || {};

    const total =
        toNumber(
            stats.total_users ??
            data.total_users ??
            users.length
        );

    const active =
        toNumber(
            stats.active_users ??
            data.active_users ??
            users.filter(
                user => user.status === "active"
            ).length
        );

    const blocked =
        toNumber(
            stats.blocked_users ??
            data.blocked_users ??
            users.filter(
                user =>
                    user.status === "blocked" ||
                    user.status === "suspended" ||
                    user.status === "disabled"
            ).length
        );

    const admins =
        toNumber(
            stats.admin_users ??
            data.admin_users ??
            users.filter(
                user =>
                    user.role === "admin" ||
                    user.account_type === "admin" ||
                    user.account_type === "administrator"
            ).length
        );


    setText("totalUsers", formatInteger(total));
    setText("activeUsers", formatInteger(active));
    setText("blockedUsers", formatInteger(blocked));
    setText("adminUsers", formatInteger(admins));
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters(resetPage = true) {

    if (resetPage) {
        currentPage = 1;
    }

    const searchInput = $("searchUsers");
    const statusSelect = $("statusFilter");
    const accountSelect = $("accountTypeFilter");


    const search = String(
        searchInput?.value || ""
    )
        .trim()
        .toLowerCase();


    const status =
        String(
            statusSelect?.value || ""
        )
        .trim()
        .toLowerCase();


    const accountType =
        String(
            accountSelect?.value || ""
        )
        .trim()
        .toLowerCase();


    filteredUsers = allUsers.filter(user => {

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


        const matchesSearch =
            !search ||
            searchable.includes(search);


        const matchesStatus =
            !status ||
            status === "all" ||
            user.status === status;


        let userAccountType =
            user.account_type;


        if (
            user.role === "admin" ||
            userAccountType === "administrator"
        ) {
            userAccountType = "admin";
        }


        const matchesAccount =
            !accountType ||
            accountType === "all" ||
            userAccountType === accountType;


        return (
            matchesSearch &&
            matchesStatus &&
            matchesAccount
        );

    });


    renderCurrentPage();
}


/* =========================================================
   RENDER CURRENT PAGE
   ========================================================= */

function renderCurrentPage() {

    const start =
        (currentPage - 1) * PAGE_SIZE;

    const end =
        start + PAGE_SIZE;

    const pageUsers =
        filteredUsers.slice(
            start,
            end
        );


    renderUsers(pageUsers);

    renderPagination(
        filteredUsers.length
    );


    if (
        filteredUsers.length === 0 &&
        allUsers.length > 0
    ) {

        showUsersEmpty();

    } else {

        hideUsersEmpty();

    }
}


/* =========================================================
   RENDER USERS
   ========================================================= */

function renderUsers(users) {

    const tbody = $("usersTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";


    if (!users.length) {
        return;
    }


    users.forEach(user => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>
                <div class="user-table-profile">

                    <div class="user-table-avatar">
                        ${escapeHTML(
                            getInitials(
                                user.full_name
                            )
                        )}
                    </div>

                    <div class="user-table-info">

                        <strong>
                            ${escapeHTML(
                                user.full_name ||
                                "Unknown User"
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
                    "Not provided"
                )}
            </td>


            <td>
                <strong class="balance-value">
                    ${formatCurrency(
                        user.balance
                    )}
                </strong>
            </td>


            <td>
                <span class="status-badge ${getStatusClass(
                    user.status
                )}">
                    ${escapeHTML(
                        capitalize(
                            user.status
                        )
                    )}
                </span>
            </td>


            <td>
                <span class="account-badge">
                    ${escapeHTML(
                        formatAccountType(
                            user
                        )
                    )}
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
                    type="button"
                    class="table-view-button"
                    data-user-id="${escapeHTML(
                        user.id
                    )}"
                    aria-label="View user"
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


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination(totalItems) {

    const container = $("pagination");

    if (!container) {
        return;
    }


    container.innerHTML = "";


    const totalPages =
        Math.ceil(
            totalItems / PAGE_SIZE
        );


    if (totalPages <= 1) {
        return;
    }


    const wrapper =
        document.createElement("div");

    wrapper.className =
        "pagination-controls";


    const previous =
        document.createElement("button");

    previous.type = "button";

    previous.className =
        "pagination-button";

    previous.disabled =
        currentPage <= 1;

    previous.innerHTML = `
        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="m15 18-6-6 6-6"></path>
        </svg>
        Previous
    `;


    previous.addEventListener(
        "click",
        () => {

            if (currentPage > 1) {

                currentPage--;

                renderCurrentPage();

                scrollToUsers();

            }

        }
    );


    wrapper.appendChild(previous);


    const pageInfo =
        document.createElement("span");

    pageInfo.className =
        "pagination-info";

    pageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;


    wrapper.appendChild(pageInfo);


    const next =
        document.createElement("button");

    next.type = "button";

    next.className =
        "pagination-button";

    next.disabled =
        currentPage >= totalPages;

    next.innerHTML = `
        Next

        <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    `;


    next.addEventListener(
        "click",
        () => {

            if (currentPage < totalPages) {

                currentPage++;

                renderCurrentPage();

                scrollToUsers();

            }

        }
    );


    wrapper.appendChild(next);

    container.appendChild(wrapper);
}


/* =========================================================
   USER MODAL
   ========================================================= */

function openUserModal(user) {

    if (!user) {
        return;
    }

    selectedUser = user;


    setText(
        "modalUserName",
        user.full_name ||
        "Unknown User"
    );


    setText(
        "modalUserEmail",
        user.email ||
        "Not provided"
    );


    setText(
        "modalUserPhone",
        user.phone ||
        "Not provided"
    );


    setText(
        "modalReferralCode",
        user.referral_code ||
        "Not assigned"
    );


    setText(
        "modalUserBalance",
        formatCurrency(
            user.balance
        )
    );


    setText(
        "modalUserStatus",
        capitalize(
            user.status
        )
    );


    setText(
        "modalAccountType",
        formatAccountType(
            user
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

    if (!modal) {
        return;
    }


    modal.classList.add("active");

    modal.classList.remove("hidden");

    modal.style.display = "flex";

    document.body.classList.add(
        "modal-open"
    );
}


/* =========================================================
   CLOSE USER MODAL
   ========================================================= */

function closeUserModal() {

    const modal =
        $("userModal");

    if (!modal) {
        return;
    }


    modal.classList.remove("active");

    modal.classList.add("hidden");

    modal.style.display = "none";

    document.body.classList.remove(
        "modal-open"
    );

    selectedUser = null;
}


/* =========================================================
   MANAGEMENT BUTTON
   ========================================================= */

function handleManageUser() {

    if (!selectedUser) {

        showUsersMessage(
            "Please select a user first.",
            "error"
        );

        return;
    }


    /*
     * The separate admin-user-actions.js file
     * can use this selected user.
     */

    if (
        window.CrownCashAdminUserActions &&
        typeof window.CrownCashAdminUserActions.open ===
        "function"
    ) {

        window.CrownCashAdminUserActions.open(
            selectedUser
        );

        return;
    }


    showUsersMessage(
        `Selected ${selectedUser.full_name}. User management controls are available on this account.`,
        "success"
    );
}


/* =========================================================
   SEARCH + FILTER EVENTS
   ========================================================= */

function setupFilters() {

    const search =
        $("searchUsers");

    const status =
        $("statusFilter");

    const accountType =
        $("accountTypeFilter");


    if (search) {

        search.addEventListener(
            "input",
            () => applyFilters(true)
        );

    }


    if (status) {

        status.addEventListener(
            "change",
            () => applyFilters(true)
        );

    }


    if (accountType) {

        accountType.addEventListener(
            "change",
            () => applyFilters(true)
        );

    }
}


/* =========================================================
   REFRESH
   ========================================================= */

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

            button.classList.add(
                "is-loading"
            );


            try {

                await loadUsers();

            } finally {

                button.disabled = false;

                button.classList.remove(
                    "is-loading"
                );

            }

        }
    );
}


/* =========================================================
   TABLE VIEW BUTTON
   ========================================================= */

function setupTableActions() {

    const tbody =
        $("usersTableBody");

    if (!tbody) {
        return;
    }


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


            const userId =
                button.dataset.userId;


            const user =
                allUsers.find(
                    item =>
                        String(item.id) ===
                        String(userId)
                );


            if (user) {

                openUserModal(user);

            }

        }
    );
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


    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("open");
        }

        if (overlay) {
            overlay.classList.add("active");
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
            overlay.classList.remove("active");
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


    if (sidebar) {

        sidebar
            .querySelectorAll("a")
            .forEach(link => {

                link.addEventListener(
                    "click",
                    () => {

                        if (
                            window.innerWidth <=
                            900
                        ) {

                            closeSidebar();

                        }

                    }
                );

            });

    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const button =
        $("logoutBtn");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            button.disabled = true;


            try {

                await fetchWithTimeout(
                    LOGOUT_API,
                    {
                        method: "GET",
                        credentials: "include",
                        headers: {
                            "Accept":
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
    );
}


/* =========================================================
   MODAL EVENTS
   ========================================================= */

function setupModal() {

    const closeButton =
        $("closeUserModal");

    const modal =
        $("userModal");

    const manageButton =
        $("manageUserBtn");


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeUserModal
        );

    }


    if (manageButton) {

        manageButton.addEventListener(
            "click",
            handleManageUser
        );

    }


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
}


/* =========================================================
   LOADING / EMPTY STATES
   ========================================================= */

function showUsersLoading() {

    const loading =
        $("usersLoading");

    const empty =
        $("usersEmpty");


    if (loading) {
        loading.style.display = "";
    }

    if (empty) {
        empty.style.display = "none";
    }
}


function hideUsersLoading() {

    const loading =
        $("usersLoading");

    if (loading) {
        loading.style.display = "none";
    }
}


function showUsersEmpty() {

    const empty =
        $("usersEmpty");

    if (empty) {

        empty.style.display = "";

        empty.classList.remove(
            "hidden"
        );

    }
}


function hideUsersEmpty() {

    const empty =
        $("usersEmpty");

    if (empty) {

        empty.style.display = "none";

        empty.classList.add(
            "hidden"
        );

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
        $("usersMessage");

    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `admin-message ${type}`;


    element.style.display =
        "block";


    clearTimeout(
        showUsersMessage.timeout
    );


    showUsersMessage.timeout =
        setTimeout(() => {

            element.style.display =
                "none";

        }, 6000);
}


/* =========================================================
   TEXT HELPER
   ========================================================= */

function setText(id, value) {

    const element =
        $(id);

    if (!element) {
        return;
    }

    element.textContent =
        value ?? "";
}


/* =========================================================
   FORMATTING
   ========================================================= */

function formatCurrency(value) {

    const amount =
        toNumber(value);


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


function formatInteger(value) {

    return toNumber(value)
        .toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        );
}


function formatDate(value) {

    if (!value) {
        return "—";
    }


    let date;


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
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function capitalize(value) {

    const text =
        String(
            value ||
            ""
        );


    if (!text) {
        return "Unknown";
    }


    return text.charAt(0).toUpperCase() +
        text.slice(1);
}


function formatAccountType(user) {

    if (!user) {
        return "User";
    }


    if (
        user.role === "admin" ||
        user.account_type === "admin" ||
        user.account_type === "administrator"
    ) {

        return "Administrator";

    }


    return "User";
}


function getStatusClass(status) {

    switch (
        String(
            status ||
            ""
        ).toLowerCase()
    ) {

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


function getInitials(name) {

    const words =
        String(
            name ||
            "User"
        )
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!words.length) {
        return "U";
    }


    if (words.length === 1) {

        return words[0]
            .substring(0, 2)
            .toUpperCase();

    }


    return (
        words[0].charAt(0) +
        words[words.length - 1].charAt(0)
    ).toUpperCase();
}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {

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
   SCROLL
   ========================================================= */

function scrollToUsers() {

    const table =
        $("usersTableBody");

    if (!table) {
        return;
    }


    const container =
        table.closest(
            ".admin-card, .users-card, .table-card"
        );


    if (container) {

        container.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashAdminUsers = {

    loadUsers,

    refresh: loadUsers,

    applyFilters,

    getUsers: () => [
        ...allUsers
    ],

    getFilteredUsers: () => [
        ...filteredUsers
    ],

    getSelectedUser: () =>
        selectedUser,

    openUserModal,

    closeUserModal,

    showMessage: showUsersMessage
};


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeAdminUsers() {

    /*
     * Show loader immediately.
     */

    showPageLoader();


    /*
     * Set up interface BEFORE network calls.
     * This means the page is usable even if an API
     * has a problem.
     */

    setupFilters();

    setupRefresh();

    setupTableActions();

    setupSidebar();

    setupLogout();

    setupModal();


    try {

        /*
         * Step 1 — Verify admin.
         */

        const authorized =
            await verifyAdmin();


        if (!authorized) {

            /*
             * verifyAdmin already handles
             * unauthorized/failed states.
             */

            return;
        }


        /*
         * Step 2 — Load profile.
         */

        await loadAdminProfile();


        /*
         * Step 3 — Load users.
         */

        await loadUsers();


    } catch (error) {

        console.error(
            "Admin users initialization error:",
            error
        );


        showUsersMessage(
            error.message ||
            "Unable to initialize user management.",
            "error"
        );


    } finally {

        /*
         * ABSOLUTE FINAL SAFETY NET.
         *
         * Regardless of what happens,
         * the full-screen loader disappears.
         */

        hidePageLoader();

    }
}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminUsers
    );

} else {

    initializeAdminUsers();

}