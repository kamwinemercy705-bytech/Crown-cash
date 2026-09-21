document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "https://crown-cash1.onrender.com";
    const USERS_API = `${API_BASE}/users.php`;
    const LOGOUT_API = `${API_BASE}/logout.php`;

    const usersTable = document.getElementById("usersTable");
    const searchUser = document.getElementById("searchUser");
    const statusFilter = document.getElementById("statusFilter");
    const roleFilter = document.getElementById("roleFilter");
    const refreshBtn = document.getElementById("refreshUsers");
    const userCount = document.getElementById("userCount");

    const totalUsers = document.getElementById("totalUsers");
    const activeUsers = document.getElementById("activeUsers");
    const pendingUsers = document.getElementById("pendingUsers");
    const blockedUsers = document.getElementById("blockedUsers");

    let allUsers = [];

    /* =========================
       HELPERS
    ========================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getUserId(user) {
        if (!user) return "";

        if (typeof user.id === "string") {
            return user.id;
        }

        if (user._id) {
            if (typeof user._id === "string") {
                return user._id;
            }

            if (user._id.$oid) {
                return user._id.$oid;
            }
        }

        return "";
    }

    function getName(user) {
        if (!user) return "Unknown User";

        if (user.full_name) {
            return String(user.full_name).trim();
        }

        const first = String(user.first_name || "").trim();
        const last = String(user.last_name || "").trim();

        const name = `${first} ${last}`.trim();

        return name || "Unknown User";
    }

    function getInitials(name) {
        const parts = String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (parts.length === 0) {
            return "U";
        }

        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }

        return (
            parts[0].charAt(0) +
            parts[parts.length - 1].charAt(0)
        ).toUpperCase();
    }

    function formatUGX(amount) {
        const number = Number(amount || 0);

        return `UGX ${number.toLocaleString("en-UG", {
            maximumFractionDigits: 0
        })}`;
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return "—";
        }

        let date;

        if (
            typeof dateValue === "object" &&
            dateValue.$date
        ) {
            date = new Date(dateValue.$date);
        } else {
            date = new Date(dateValue);
        }

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-UG", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function normalizeStatus(status) {
        return String(status || "active")
            .trim()
            .toLowerCase();
    }

    function normalizeRole(role) {
        return String(role || "user")
            .trim()
            .toLowerCase();
    }

    function showToast(message, type = "success") {
        let toast = document.getElementById("usersToast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "usersToast";
            toast.className = "users-toast";
            document.body.appendChild(toast);
        }

        toast.className = `users-toast ${type}`;
        toast.textContent = message;

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function showLoading() {
        usersTable.innerHTML = `
            <tr>
                <td colspan="8" class="loading-state">
                    <div class="loading-spinner"></div>
                    <span>Loading users...</span>
                </td>
            </tr>
        `;
    }

    function showEmpty(message = "No users found.") {
        usersTable.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-icon">♙</div>
                    <strong>${escapeHTML(message)}</strong>
                    <span>Try changing your search or filters.</span>
                </td>
            </tr>
        `;
    }

    function showError(message) {
        usersTable.innerHTML = `
            <tr>
                <td colspan="8" class="error-state">
                    <div class="error-icon">!</div>
                    <strong>Unable to load users</strong>
                    <span>${escapeHTML(message)}</span>
                    <button type="button" id="retryUsers">
                        Retry
                    </button>
                </td>
            </tr>
        `;

        const retry = document.getElementById("retryUsers");

        if (retry) {
            retry.addEventListener("click", loadUsers);
        }
    }

    /* =========================
       FETCH USERS
    ========================= */

    async function loadUsers() {
        showLoading();

        try {
            const response = await fetch(USERS_API, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data || data.success !== true) {
                throw new Error(
                    data?.message ||
                    `Request failed with status ${response.status}`
                );
            }

            allUsers = Array.isArray(data.users)
                ? data.users
                : [];

            updateStats(data.stats || {});
            applyFilters();

        } catch (error) {
            console.error("Users loading error:", error);

            showError(
                error.message ||
                "Please check your connection and try again."
            );
        }
    }

    /* =========================
       STATISTICS
    ========================= */

    function updateStats(stats) {
        const total =
            stats.total ??
            allUsers.length;

        const active =
            stats.active ??
            allUsers.filter(
                user => normalizeStatus(user.status) === "active"
            ).length;

        const pending =
            stats.pending ??
            allUsers.filter(
                user => normalizeStatus(user.status) === "pending"
            ).length;

        const blocked =
            stats.blocked ??
            allUsers.filter(user => {
                const status = normalizeStatus(user.status);

                return (
                    status === "blocked" ||
                    status === "suspended" ||
                    status === "disabled"
                );
            }).length;

        if (totalUsers) {
            totalUsers.textContent =
                Number(total).toLocaleString();
        }

        if (activeUsers) {
            activeUsers.textContent =
                Number(active).toLocaleString();
        }

        if (pendingUsers) {
            pendingUsers.textContent =
                Number(pending).toLocaleString();
        }

        if (blockedUsers) {
            blockedUsers.textContent =
                Number(blocked).toLocaleString();
        }
    }

    /* =========================
       FILTERING
    ========================= */

    function applyFilters() {
        const search = String(
            searchUser?.value || ""
        )
            .trim()
            .toLowerCase();

        const selectedStatus = String(
            statusFilter?.value || ""
        )
            .trim()
            .toLowerCase();

        const selectedRole = String(
            roleFilter?.value || ""
        )
            .trim()
            .toLowerCase();

        const filteredUsers = allUsers.filter(user => {
            const name = getName(user).toLowerCase();

            const email = String(
                user.email || ""
            ).toLowerCase();

            const phone = String(
                user.phone || ""
            ).toLowerCase();

            const referralCode = String(
                user.referral_code || ""
            ).toLowerCase();

            const role = normalizeRole(
                user.role ||
                user.account_type
            );

            const status = normalizeStatus(
                user.status
            );

            const matchesSearch =
                !search ||
                name.includes(search) ||
                email.includes(search) ||
                phone.includes(search) ||
                referralCode.includes(search);

            const matchesStatus =
                !selectedStatus ||
                selectedStatus === "all" ||
                status === selectedStatus;

            const matchesRole =
                !selectedRole ||
                selectedRole === "all" ||
                role === selectedRole;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesRole
            );
        });

        renderUsers(filteredUsers);

        if (userCount) {
            userCount.textContent =
                `${filteredUsers.length} user${
                    filteredUsers.length === 1 ? "" : "s"
                }`;
        }
    }

    /* =========================
       RENDER USERS
    ========================= */

    function renderUsers(users) {
        if (!Array.isArray(users) || users.length === 0) {
            showEmpty();
            return;
        }

        usersTable.innerHTML = users.map(user => {
            const id = getUserId(user);
            const name = getName(user);
            const initials = getInitials(name);

            const email =
                user.email || "No email";

            const phone =
                user.phone || "No phone";

            const balance =
                user.balance ?? 0;

            const role =
                normalizeRole(
                    user.role ||
                    user.account_type
                );

            const status =
                normalizeStatus(user.status);

            const joined =
                formatDate(
                    user.created_at ||
                    user.joined_at ||
                    user.date_created
                );

            const safeId =
                escapeHTML(id);

            const roleClass =
                role === "admin"
                    ? "admin"
                    : "user";

            let statusClass = "active";

            if (
                status === "blocked" ||
                status === "disabled"
            ) {
                statusClass = "blocked";
            } else if (status === "suspended") {
                statusClass = "suspended";
            } else if (status === "pending") {
                statusClass = "pending";
            }

            return `
                <tr data-user-id="${safeId}">

                    <td>
                        <div class="user-cell">

                            <div class="user-avatar">
                                ${escapeHTML(initials)}
                            </div>

                            <div class="user-details">
                                <strong>
                                    ${escapeHTML(name)}
                                </strong>

                                <small>
                                    ID: ${escapeHTML(
                                        id
                                            ? id.substring(0, 10)
                                            : "N/A"
                                    )}
                                </small>
                            </div>

                        </div>
                    </td>

                    <td>
                        <span class="user-phone">
                            ${escapeHTML(phone)}
                        </span>
                    </td>

                    <td>
                        <span class="user-email">
                            ${escapeHTML(email)}
                        </span>
                    </td>

                    <td>
                        <strong class="balance">
                            ${escapeHTML(
                                formatUGX(balance)
                            )}
                        </strong>
                    </td>

                    <td>
                        <span class="role-badge ${roleClass}">
                            ${escapeHTML(
                                role.charAt(0).toUpperCase() +
                                role.slice(1)
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="status-badge ${statusClass}">
                            <span class="status-dot"></span>
                            ${escapeHTML(
                                status.charAt(0).toUpperCase() +
                                status.slice(1)
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="joined-date">
                            ${escapeHTML(joined)}
                        </span>
                    </td>

                    <td>
                        <div class="user-actions">

                            <button
                                type="button"
                                class="action-btn view"
                                data-action="view"
                                data-user-id="${safeId}"
                                title="View user"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>

                            <button
                                type="button"
                                class="action-btn toggle"
                                data-action="toggle"
                                data-user-id="${safeId}"
                                data-status="${escapeHTML(status)}"
                                title="${
                                    status === "blocked" ||
                                    status === "suspended" ||
                                    status === "disabled"
                                        ? "Activate user"
                                        : "Block user"
                                }"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    ${
                                        status === "blocked" ||
                                        status === "suspended" ||
                                        status === "disabled"
                                            ? `
                                                <path d="M5 12l4 4L19 6"/>
                                            `
                                            : `
                                                <circle cx="12" cy="12" r="9"/>
                                                <path d="M8 8l8 8"/>
                                                <path d="M16 8l-8 8"/>
                                            `
                                    }
                                </svg>
                            </button>

                            <button
                                type="button"
                                class="action-btn role"
                                data-action="role"
                                data-user-id="${safeId}"
                                data-role="${escapeHTML(role)}"
                                title="Change role"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path d="M12 15c3 0 5 2 5 5H7c0-3 2-5 5-5Z"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </button>

                        </div>
                    </td>

                </tr>
            `;
        }).join("");
    }

    /* =========================
       USER ACTIONS
    ========================= */

    async function updateUser(action, userId, extra = {}) {
        if (!userId) {
            showToast(
                "User ID is missing.",
                "error"
            );
            return;
        }

        try {
            const response = await fetch(USERS_API, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    action,
                    user_id: userId,
                    ...extra
                })
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data || data.success !== true) {
                throw new Error(
                    data?.message ||
                    `Action failed with status ${response.status}`
                );
            }

            showToast(
                data.message ||
                "User updated successfully."
            );

            await loadUsers();

        } catch (error) {
            console.error("User action error:", error);

            showToast(
                error.message ||
                "Unable to update user.",
                "error"
            );
        }
    }

    function viewUser(userId) {
        const user = allUsers.find(
            item => getUserId(item) === userId
        );

        if (!user) {
            showToast(
                "User information was not found.",
                "error"
            );
            return;
        }

        const name = getName(user);

        const details = [
            `Name: ${name}`,
            `Email: ${user.email || "N/A"}`,
            `Phone: ${user.phone || "N/A"}`,
            `Balance: ${formatUGX(user.balance || 0)}`,
            `Role: ${user.role || user.account_type || "user"}`,
            `Status: ${user.status || "active"}`,
            `Referral