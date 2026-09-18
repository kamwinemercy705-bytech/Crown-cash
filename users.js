/* =========================================================
   CROWN CASH — ADMIN USERS MANAGEMENT
   users.js
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

let allUsers = [];
let selectedUser = null;


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const usersTableBody = document.getElementById("usersTableBody");

const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");

const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const roleFilter = document.getElementById("roleFilter");

const totalUsers = document.getElementById("totalUsers");
const activeUsers = document.getElementById("activeUsers");
const pendingUsers = document.getElementById("pendingUsers");
const blockedUsers = document.getElementById("blockedUsers");

const refreshBtn = document.getElementById("refreshBtn");
const retryBtn = document.getElementById("retryBtn");

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const logoutBtn = document.getElementById("logoutBtn");

const userModal = document.getElementById("userModal");
const modalClose = document.getElementById("modalClose");

const modalAvatar = document.getElementById("modalAvatar");
const modalName = document.getElementById("modalName");
const modalEmail = document.getElementById("modalEmail");
const modalPhone = document.getElementById("modalPhone");
const modalReferral = document.getElementById("modalReferral");
const modalBalance = document.getElementById("modalBalance");
const modalRole = document.getElementById("modalRole");
const modalStatus = document.getElementById("modalStatus");
const modalJoined = document.getElementById("modalJoined");

const blockUserBtn = document.getElementById("blockUserBtn");
const activateUserBtn = document.getElementById("activateUserBtn");

const adminName = document.getElementById("adminName");


/* =========================================================
   PAGE START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupEvents();

    loadUsers();

});


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    if (searchInput) {
        searchInput.addEventListener("input", renderUsers);
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", renderUsers);
    }

    if (roleFilter) {
        roleFilter.addEventListener("change", renderUsers);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadUsers);
    }

    if (retryBtn) {
        retryBtn.addEventListener("click", loadUsers);
    }

    if (menuBtn) {
        menuBtn.addEventListener("click", () => {

            sidebar.classList.toggle("open");

        });
    }

    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }

    if (userModal) {

        userModal.addEventListener("click", (event) => {

            if (event.target === userModal) {
                closeModal();
            }

        });

    }

    if (blockUserBtn) {
        blockUserBtn.addEventListener("click", () => {

            if (!selectedUser) {
                return;
            }

            updateUserStatus(selectedUser, "blocked");

        });
    }

    if (activateUserBtn) {
        activateUserBtn.addEventListener("click", () => {

            if (!selectedUser) {
                return;
            }

            updateUserStatus(selectedUser, "active");

        });
    }

    if (logoutBtn) {

        logoutBtn.addEventListener("click", async () => {

            try {

                await fetch(`${API_BASE}/logout.php`, {
                    method: "POST",
                    credentials: "include"
                });

            } catch (error) {

                console.warn("Logout request failed:", error);

            }

            window.location.href =
                "https://crown-cash.vercel.app/login.html";

        });

    }

}


/* =========================================================
   LOAD USERS
   ========================================================= */

async function loadUsers() {

    showLoading();

    hideError();

    try {

        /*
         * This endpoint is expected to be created on the
         * Crown Cash PHP backend.
         *
         * Example:
         * https://crown-cash1.onrender.com/admin-users.php
         */

        const response = await fetch(
            `${API_BASE}/admin-users.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        let data = null;

        try {
            data = await response.json();
        } catch (jsonError) {

            throw new Error(
                "The server returned an invalid response."
            );

        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                data?.error ||
                `Server error (${response.status})`
            );

        }


        if (data.success === false) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to load users."
            );

        }


        /*
         * Support different possible API response formats.
         */

        if (Array.isArray(data)) {

            allUsers = data;

        } else if (Array.isArray(data.users)) {

            allUsers = data.users;

        } else if (Array.isArray(data.data)) {

            allUsers = data.data;

        } else {

            allUsers = [];

        }


        updateStatistics();

        renderUsers();

        hideLoading();

    } catch (error) {

        console.error("Users loading error:", error);

        hideLoading();

        showError(
            error.message ||
            "Unable to load users. Please try again."
        );

    }

}


/* =========================================================
   NORMALIZE USER DATA
   ========================================================= */

function normalizeUser(user) {

    if (!user || typeof user !== "object") {

        return {
            id: "",
            name: "Unknown User",
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            referralCode: "",
            balance: 0,
            role: "user",
            status: "active",
            createdAt: null
        };

    }


    const firstName =
        user.first_name ||
        user.firstName ||
        "";

    const lastName =
        user.last_name ||
        user.lastName ||
        "";


    let name =
        user.name ||
        user.full_name ||
        user.fullName ||
        "";


    if (!name) {

        name =
            `${firstName} ${lastName}`.trim();

    }


    if (!name) {
        name = "Unknown User";
    }


    return {

        id:
            user.id ||
            user._id ||
            user.user_id ||
            user.userId ||
            "",

        name,

        firstName,

        lastName,

        email:
            user.email ||
            "",

        phone:
            user.phone ||
            user.phone_number ||
            "",

        referralCode:
            user.referral_code ||
            user.referralCode ||
            "",

        balance:
            Number(
                user.balance ??
                user.wallet_balance ??
                user.walletBalance ??
                0
            ) || 0,

        role:
            String(
                user.role ||
                user.account_type ||
                user.accountType ||
                "user"
            ).toLowerCase(),

        status:
            String(
                user.status ||
                user.account_status ||
                user.accountStatus ||
                "active"
            ).toLowerCase(),

        createdAt:
            user.created_at ||
            user.createdAt ||
            user.date_joined ||
            user.dateJoined ||
            null

    };

}


/* =========================================================
   FILTER USERS
   ========================================================= */

function getFilteredUsers() {

    const search =
        (searchInput?.value || "")
            .trim()
            .toLowerCase();


    const status =
        statusFilter?.value || "all";


    const role =
        roleFilter?.value || "all";


    return allUsers
        .map(normalizeUser)
        .filter(user => {

            const searchableText = [

                user.name,
                user.email,
                user.phone,
                user.referralCode

            ]
                .join(" ")
                .toLowerCase();


            const matchesSearch =
                !search ||
                searchableText.includes(search);


            const matchesStatus =
                status === "all" ||
                normalizeStatus(user.status) === status;


            const matchesRole =
                role === "all" ||
                normalizeRole(user.role) === role;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesRole
            );

        });

}


/* =========================================================
   RENDER USERS
   ========================================================= */

function renderUsers() {

    if (!usersTableBody) {
        return;
    }


    const users = getFilteredUsers();


    usersTableBody.innerHTML = "";


    if (users.length === 0) {

        emptyState.hidden = false;

        return;

    }


    emptyState.hidden = true;


    users.forEach(user => {

        const row = document.createElement("tr");


        const initials =
            getInitials(user.name);


        const status =
            normalizeStatus(user.status);


        const role =
            normalizeRole(user.role);


        row.innerHTML = `

            <td>

                <div class="user-cell">

                    <div class="user-avatar">
                        ${escapeHtml(initials)}
                    </div>

                    <div class="user-info">

                        <strong>
                            ${escapeHtml(user.name)}
                        </strong>

                        <small>
                            ${escapeHtml(
                                user.referralCode
                                    ? "Ref: " + user.referralCode
                                    : "Crown Cash Member"
                            )}
                        </small>

                    </div>

                </div>

            </td>


            <td>
                ${escapeHtml(user.phone || "—")}
            </td>


            <td>
                ${escapeHtml(user.email || "—")}
            </td>


            <td>
                <strong>
                    ${formatUGX(user.balance)}
                </strong>
            </td>


            <td>

                <span class="role-badge role-${role}">
                    ${escapeHtml(
                        role === "admin"
                            ? "Admin"
                            : "User"
                    )}
                </span>

            </td>


            <td>

                <span class="status-badge status-${status}">
                    ${escapeHtml(status)}
                </span>

            </td>


            <td>
                ${formatDate(user.createdAt)}
            </td>


            <td>

                <button
                    class="view-user-btn"
                    type="button"
                    title="View user"
                    data-user-id="${escapeHtml(String(user.id))}"
                >

                    <svg viewBox="0 0 24 24">

                        <path
                            d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                        ></path>

                        <circle
                            cx="12"
                            cy="12"
                            r="2.5"
                        ></circle>

                    </svg>

                </button>

            </td>

        `;


        const viewButton =
            row.querySelector(".view-user-btn");


        if (viewButton) {

            viewButton.addEventListener(
                "click",
                () => openUserModal(user)
            );

        }


        usersTableBody.appendChild(row);

    });

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const users =
        allUsers.map(normalizeUser);


    const total =
        users.length;


    const active =
        users.filter(
            user => normalizeStatus(user.status) === "active"
        ).length;


    const pending =
        users.filter(
            user => normalizeStatus(user.status) === "pending"
        ).length;


    const blocked =
        users.filter(
            user => normalizeStatus(user.status) === "blocked"
        ).length;


    if (totalUsers) {
        animateNumber(totalUsers, total);
    }

    if (activeUsers) {
        animateNumber(activeUsers, active);
    }

    if (pendingUsers) {
        animateNumber(pendingUsers, pending);
    }

    if (blockedUsers) {
        animateNumber(blockedUsers, blocked);
    }

}


/* =========================================================
   NUMBER ANIMATION
   ========================================================= */

function animateNumber(element, target) {

    const start =
        Number(element.textContent) || 0;


    const duration = 500;

    const startTime = performance.now();


    function update(currentTime) {

        const progress =
            Math.min(
                (currentTime - startTime) / duration,
                1
            );


        const value =
            Math.floor(
                start +
                (target - start) * progress
            );


        element.textContent =
            value.toLocaleString();


        if (progress < 1) {

            requestAnimationFrame(update);

        }

    }


    requestAnimationFrame(update);

}


/* =========================================================
   USER MODAL
   ========================================================= */

function openUserModal(user) {

    selectedUser = user;


    if (!userModal) {
        return;
    }


    const initials =
        getInitials(user.name);


    modalAvatar.textContent =
        initials;


    modalName.textContent =
        user.name || "Unknown User";


    modalEmail.textContent =
        user.email || "No email";


    modalPhone.textContent =
        user.phone || "—";


    modalReferral.textContent =
        user.referralCode || "—";


    modalBalance.textContent =
        formatUGX(user.balance);


    modalRole.textContent =
        normalizeRole(user.role) === "admin"
            ? "Administrator"
            : "User";


    modalStatus.textContent =
        capitalize(
            normalizeStatus(user.status)
        );


    modalJoined.textContent =
        formatDate(user.createdAt);


    /*
     * Show the correct action button.
     */

    const status =
        normalizeStatus(user.status);


    if (blockUserBtn) {

        blockUserBtn.hidden =
            status === "blocked";

    }


    if (activateUserBtn) {

        activateUserBtn.hidden =
            status === "active";

    }


    userModal.hidden = false;

    document.body.style.overflow = "hidden";

}


/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeModal() {

    if (userModal) {

        userModal.hidden = true;

    }


    document.body.style.overflow = "";

    selectedUser = null;

}


/* =========================================================
   UPDATE USER STATUS
   ========================================================= */

async function updateUserStatus(user, newStatus) {

    if (!user || !user.id) {

        alert(
            "This user does not have a valid user ID."
        );

        return;

    }


    const action =
        newStatus === "blocked"
            ? "block"
            : "activate";


    const confirmation =
        window.confirm(
            `Are you sure you want to ${action} ${user.name}?`
        );


    if (!confirmation) {
        return;
    }


    try {

        blockUserBtn.disabled = true;
        activateUserBtn.disabled = true;


        const response = await fetch(
            `${API_BASE}/admin-users.php`,
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({

                    action: "update_status",

                    user_id: user.id,

                    status: newStatus

                })

            }
        );


        let data = null;


        try {

            data = await response.json();

        } catch (jsonError) {

            throw new Error(
                "The server returned an invalid response."
            );

        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                data?.error ||
                `Unable to update user (${response.status})`
            );

        }


        if (data.success === false) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to update user."
            );

        }


        /*
         * Update the local copy immediately.
         */

        const index =
            allUsers.findIndex(item => {

                const normalized =
                    normalizeUser(item);

                return String(normalized.id) ===
                    String(user.id);

            });


        if (index !== -1) {

            allUsers[index].status =
                newStatus;

        }


        closeModal();

        updateStatistics();

        renderUsers();


        alert(
            newStatus === "blocked"
                ? "User has been blocked."
                : "User has been activated."
        );


    } catch (error) {

        console.error(
            "User status update error:",
            error
        );


        alert(
            error.message ||
            "Unable to update user."
        );


    } finally {

        if (blockUserBtn) {
            blockUserBtn.disabled = false;
        }

        if (activateUserBtn) {
            activateUserBtn.disabled = false;
        }

    }

}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {

    if (loading) {
        loading.hidden = false;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    if (usersTableBody) {
        usersTableBody.innerHTML = "";
    }

}


/* =========================================================
   HIDE LOADING
   ========================================================= */

function hideLoading() {

    if (loading) {
        loading.hidden = true;
    }

}


/* =========================================================
   ERROR
   ========================================================= */

function showError(message) {

    if (!errorBox) {
        return;
    }


    errorMessage.textContent =
        message ||
        "Unable to load users.";


    errorBox.hidden = false;

}


function hideError() {

    if (errorBox) {
        errorBox.hidden = true;
    }

}


/* =========================================================
   STATUS NORMALIZATION
   ========================================================= */

function normalizeStatus(status) {

    const value =
        String(status || "active")
            .trim()
            .toLowerCase();


    if (
        value === "active" ||
        value === "approved" ||
        value === "enabled"
    ) {

        return "active";

    }


    if (
        value === "pending" ||
        value === "waiting"
    ) {

        return "pending";

    }


    if (
        value === "blocked" ||
        value === "suspended" ||
        value === "disabled"
    ) {

        return "blocked";

    }


    return "active";

}


/* =========================================================
   ROLE NORMALIZATION
   ========================================================= */

function normalizeRole(role) {

    const value =
        String(role || "user")
            .trim()
            .toLowerCase();


    if (
        value === "admin" ||
        value === "administrator"
    ) {

        return "admin";

    }


    return "user";

}


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(amount) {

    const number =
        Number(amount) || 0;


    return (
        "UGX " +
        number.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        )
    );

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }


    let date;


    /*
     * MongoDB Extended JSON:
     * { "$date": "..." }
     */

    if (
        typeof value === "object" &&
        value.$date
    ) {

        date =
            new Date(value.$date);

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

}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(name) {

    const clean =
        String(name || "")
            .trim();


    if (!clean) {
        return "U";
    }


    const parts =
        clean
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


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    const text =
        String(value || "");


    if (!text) {
        return "";
    }


    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   CLOSE SIDEBAR AFTER NAVIGATION
   ========================================================= */

document.querySelectorAll(".sidebar a").forEach(link => {

    link.addEventListener("click", () => {

        if (
            window.innerWidth <= 760 &&
            sidebar
        ) {

            sidebar.classList.remove("open");

        }

    });

});


/* =========================================================
   ESCAPE KEY
   ========================================================= */

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        if (
            userModal &&
            !userModal.hidden
        ) {

            closeModal();

        }

        if (
            sidebar &&
            sidebar.classList.contains("open")
        ) {

            sidebar.classList.remove("open");

        }

    }

});