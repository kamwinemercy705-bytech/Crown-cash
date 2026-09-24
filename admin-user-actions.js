"use strict";

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin User Actions
|--------------------------------------------------------------------------
| Handles administrator actions on user accounts.
|
| Supported:
| - Activate
| - Restore
| - Suspend
| - Block
| - Disable
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_USER_ACTIONS_API =
    `${API_BASE}/admin-user-actions.php`;


/* =========================================================
   STATE
========================================================= */

const userActionsState = {
    selectedUserId: null,
    selectedUserName: "",
    processing: false
};


/* =========================================================
   HELPERS
========================================================= */

function actionElement(id) {
    return document.getElementById(id);
}


function escapeActionHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   SET SELECTED USER
========================================================= */

function setSelectedUser(user) {

    if (!user) {
        clearSelectedUser();
        return;
    }


    userActionsState.selectedUserId =
        String(
            user.id ||
            user._id ||
            user.user_id ||
            ""
        );


    userActionsState.selectedUserName =
        String(
            user.full_name ||
            user.fullName ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.email ||
            "User"
        );
}


function setSelectedUserById(
    userId,
    userName = "User"
) {

    userActionsState.selectedUserId =
        String(userId || "");


    userActionsState.selectedUserName =
        String(userName || "User");
}


function clearSelectedUser() {

    userActionsState.selectedUserId =
        null;

    userActionsState.selectedUserName =
        "";
}


/* =========================================================
   API REQUEST
========================================================= */

async function performUserAction(
    action,
    userId = null,
    userName = null
) {

    if (
        userActionsState.processing
    ) {
        return false;
    }


    const targetUserId =
        String(
            userId ||
            userActionsState.selectedUserId ||
            ""
        ).trim();


    const targetUserName =
        String(
            userName ||
            userActionsState.selectedUserName ||
            "this user"
        ).trim();


    if (!targetUserId) {

        showActionMessage(
            "Please select a user first.",
            "error"
        );

        return false;
    }


    const allowedActions = [
        "activate",
        "restore",
        "suspend",
        "block",
        "disable"
    ];


    if (
        !allowedActions.includes(action)
    ) {

        showActionMessage(
            "Invalid administrator action.",
            "error"
        );

        return false;
    }


    const actionLabel =
        getActionLabel(action);


    const confirmed =
        await confirmUserAction(
            action,
            targetUserName
        );


    if (!confirmed) {
        return false;
    }


    userActionsState.processing =
        true;


    setActionButtonsDisabled(true);

    showActionMessage(
        `${actionLabel}ing account...`,
        "info"
    );


    try {

        const response =
            await fetch(
                ADMIN_USER_ACTIONS_API,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        user_id:
                            targetUserId,

                        action:
                            action
                    })
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;
        }


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            showActionMessage(
                data?.message ||
                "Administrator authorization failed.",
                "error"
            );


            setTimeout(
                () => {
                    window.location.href =
                        "login.html";
                },
                1200
            );


            return false;
        }


        if (
            !response.ok ||
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to update user account."
            );
        }


        showActionMessage(
            data.message ||
            `${actionLabel} completed successfully.`,
            "success"
        );


        /*
        |--------------------------------------------------------------------------
        | Refresh the user list if the main
        | admin-users.js file is loaded.
        |--------------------------------------------------------------------------
        */

        if (
            window.CrownCashAdminUsers &&
            typeof window.CrownCashAdminUsers.loadUsers ===
                "function"
        ) {

            await window.CrownCashAdminUsers.loadUsers();
        }


        /*
        |--------------------------------------------------------------------------
        | Close the user details modal.
        |--------------------------------------------------------------------------
        */

        if (
            window.CrownCashAdminUsers &&
            typeof window.CrownCashAdminUsers.closeUserModal ===
                "function"
        ) {

            window.CrownCashAdminUsers.closeUserModal();
        }


        return true;

    } catch (error) {

        console.error(
            "Admin user action error:",
            error
        );


        showActionMessage(
            error.message ||
            "Unable to update user account.",
            "error"
        );


        return false;

    } finally {

        userActionsState.processing =
            false;

        setActionButtonsDisabled(false);
    }
}


/* =========================================================
   ACTION CONFIRMATION
========================================================= */

async function confirmUserAction(
    action,
    userName
) {

    const label =
        getActionLabel(action);


    let message = "";


    switch (action) {

        case "activate":

            message =
                `Activate ${userName}'s account?`;

            break;


        case "restore":

            message =
                `Restore ${userName}'s account and set it to active?`;

            break;


        case "suspend":

            message =
                `Suspend ${userName}'s account? The user may not be able to use the account while suspended.`;

            break;


        case "block":

            message =
                `Block ${userName}'s account? This should only be done when you have verified the reason.`;

            break;


        case "disable":

            message =
                `Disable ${userName}'s account?`;

            break;


        default:

            message =
                `${label} ${userName}'s account?`;
    }


    /*
    |--------------------------------------------------------------------------
    | Use the browser confirmation dialog.
    | This avoids adding another modal dependency.
    |--------------------------------------------------------------------------
    */

    return window.confirm(
        message
    );
}


/* =========================================================
   ACTION LABEL
========================================================= */

function getActionLabel(action) {

    const labels = {

        activate: "Activat",

        restore: "Restor",

        suspend: "Suspend",

        block: "Block",

        disable: "Disabl"
    };


    return (
        labels[action] ||
        "Updat"
    );
}


/* =========================================================
   ACTION BUTTONS
========================================================= */

function setActionButtonsDisabled(
    disabled
) {

    document
        .querySelectorAll(
            "[data-user-action]"
        )
        .forEach(button => {

            button.disabled =
                disabled;
        });


    const manageButton =
        actionElement(
            "manageUserBtn"
        );


    if (manageButton) {

        manageButton.disabled =
            disabled;
    }
}


/* =========================================================
   SHOW MESSAGE
========================================================= */

function showActionMessage(
    message,
    type = "info"
) {

    /*
    |--------------------------------------------------------------------------
    | Prefer the admin-users page message.
    |--------------------------------------------------------------------------
    */

    const pageMessage =
        actionElement(
            "usersMessage"
        );


    if (pageMessage) {

        pageMessage.textContent =
            message;

        pageMessage.className =
            `admin-message ${type}`;

        pageMessage.hidden =
            false;


        /*
        |--------------------------------------------------------------------------
        | Scroll the message into view only
        | when necessary.
        |--------------------------------------------------------------------------
        */

        if (
            type === "error" ||
            type === "success"
        ) {

            pageMessage.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | Fallback notification.
    |--------------------------------------------------------------------------
    */

    console.log(
        `[${type}] ${message}`
    );
}


/* =========================================================
   ACTION MENU
========================================================= */

function createUserActionMenu(
    user
) {

    if (!user) {
        return "";
    }


    const userId =
        String(
            user.id ||
            user._id ||
            ""
        );


    const userName =
        String(
            user.full_name ||
            user.fullName ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.email ||
            "User"
        );


    const status =
        String(
            user.status ||
            "active"
        ).toLowerCase();


    let actions = "";


    if (
        status === "active"
    ) {

        actions += `
            <button
                type="button"
                class="user-action-menu-item"
                data-user-action="suspend"
                data-user-id="${escapeActionHTML(userId)}"
                data-user-name="${escapeActionHTML(userName)}"
            >
                Suspend Account
            </button>

            <button
                type="button"
                class="user-action-menu-item danger"
                data-user-action="block"
                data-user-id="${escapeActionHTML(userId)}"
                data-user-name="${escapeActionHTML(userName)}"
            >
                Block Account
            </button>

            <button
                type="button"
                class="user-action-menu-item danger"
                data-user-action="disable"
                data-user-id="${escapeActionHTML(userId)}"
                data-user-name="${escapeActionHTML(userName)}"
            >
                Disable Account
            </button>
        `;

    } else {

        actions += `
            <button
                type="button"
                class="user-action-menu-item success"
                data-user-action="activate"
                data-user-id="${escapeActionHTML(userId)}"
                data-user-name="${escapeActionHTML(userName)}"
            >
                Activate Account
            </button>

            <button
                type="button"
                class="user-action-menu-item success"
                data-user-action="restore"
                data-user-id="${escapeActionHTML(userId)}"
                data-user-name="${escapeActionHTML(userName)}"
            >
                Restore Account
            </button>
        `;
    }


    return actions;
}


/* =========================================================
   HANDLE ACTION BUTTON CLICK
========================================================= */

async function handleUserActionClick(
    button
) {

    if (!button) {
        return;
    }


    const action =
        button.dataset.userAction;


    const userId =
        button.dataset.userId;


    const userName =
        button.dataset.userName ||
        "User";


    if (!action) {
        return;
    }


    setSelectedUserById(
        userId,
        userName
    );


    await performUserAction(
        action,
        userId,
        userName
    );
}


/* =========================================================
   EVENT DELEGATION
========================================================= */

function setupActionDelegation() {

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-user-action]"
                );


            if (!button) {
                return;
            }


            event.preventDefault();


            await handleUserActionClick(
                button
            );
        }
    );
}


/* =========================================================
   CONNECT MANAGE BUTTON
========================================================= */

function setupManageUserButton() {

    const button =
        actionElement(
            "manageUserBtn"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            const selectedUser =
                window.CrownCashAdminUsers
                    ?.getSelectedUser?.();


            if (selectedUser) {

                setSelectedUser(
                    selectedUser
                );

                showManagementPanel(
                    selectedUser
                );

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | If admin-users.js doesn't expose
            | the selected user yet, use the
            | stored state.
            |--------------------------------------------------------------------------
            */

            if (
                userActionsState.selectedUserId
            ) {

                showManagementPanel({
                    id:
                        userActionsState.selectedUserId,

                    full_name:
                        userActionsState.selectedUserName
                });

                return;
            }


            showActionMessage(
                "Please select a user first.",
                "error"
            );
        }
    );
}


/* =========================================================
   MANAGEMENT PANEL
========================================================= */

function showManagementPanel(
    user
) {

    if (!user) {
        return;
    }


    setSelectedUser(
        user
    );


    const existing =
        document.getElementById(
            "userManagementPanel"
        );


    if (existing) {

        existing.remove();
    }


    const panel =
        document.createElement(
            "div"
        );


    panel.id =
        "userManagementPanel";


    panel.className =
        "user-management-panel";


    const userId =
        escapeActionHTML(
            userActionsState.selectedUserId
        );


    const userName =
        escapeActionHTML(
            userActionsState.selectedUserName
        );


    panel.innerHTML = `

        <div class="management-panel-header">

            <div>

                <strong>
                    Manage User
                </strong>

                <span>
                    ${userName}
                </span>

            </div>

            <button
                type="button"
                class="management-panel-close"
                data-close-management
                aria-label="Close user management"
            >
                ×
            </button>

        </div>


        <div class="management-panel-body">

            <p>
                Choose an account status action.
                These controls do not change the user's
                wallet balance or investment records.
            </p>


            <div class="management-actions">

                <button
                    type="button"
                    class="primary-button"
                    data-user-action="activate"
                    data-user-id="${userId}"
                    data-user-name="${userName}"
                >
                    Activate
                </button>


                <button
                    type="button"
                    class="secondary-button"
                    data-user-action="restore"
                    data-user-id="${userId}"
                    data-user-name="${userName}"
                >
                    Restore
                </button>


                <button
                    type="button"
                    class="secondary-button"
                    data-user-action="suspend"
                    data-user-id="${userId}"
                    data-user-name="${userName}"
                >
                    Suspend
                </button>


                <button
                    type="button"
                    class="secondary-button"
                    data-user-action="block"
                    data-user-id="${userId}"
                    data-user-name="${userName}"
                >
                    Block
                </button>


                <button
                    type="button"
                    class="secondary-button"
                    data-user-action="disable"
                    data-user-id="${userId}"
                    data-user-name="${userName}"
                >
                    Disable
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(
        panel
    );


    const closeButton =
        panel.querySelector(
            "[data-close-management]"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {
                panel.remove();
            }
        );
    }
}


/* =========================================================
   EXPOSE MANAGEMENT MENU
========================================================= */

window.CrownCashAdminUserActions = {

    setSelectedUser,

    setSelectedUserById,

    clearSelectedUser,

    performUserAction,

    createUserActionMenu,

    showManagementPanel,

    showActionMessage
};


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeUserActions() {

    setupActionDelegation();

    setupManageUserButton();
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeUserActions
    );

} else {

    initializeUserActions();
}