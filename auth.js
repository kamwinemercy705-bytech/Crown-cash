// ============================================
// CROWN CASH - AUTHENTICATION JAVASCRIPT
// File: auth.js
// ============================================

const API_URL = "https://crown-cash1.onrender.com";

// --------------------------------------------
// CHECK USER AUTHENTICATION
// --------------------------------------------
async function checkAuth() {
try {
const response = await fetch("${API_URL}/auth-check.php", {
method: "GET",
credentials: "include",
headers: {
"Accept": "application/json"
}
});

    const data = await response.json();

    // User is not logged in
    if (!response.ok || !data.authenticated) {
        redirectToLogin();
        return null;
    }

    // Save current user information locally
    if (data.user) {
        localStorage.setItem(
            "crownCashUser",
            JSON.stringify(data.user)
        );
    }

    return data.user;

} catch (error) {
    console.error("Authentication check failed:", error);

    // Do not trust localStorage alone as authentication.
    // If the backend cannot confirm the session,
    // send the user to login.
    redirectToLogin();

    return null;
}

}

// --------------------------------------------
// REDIRECT TO LOGIN
// --------------------------------------------
function redirectToLogin() {
const currentPage =
window.location.pathname.split("/").pop() || "index.html";

// Avoid redirect loop if already on login/register pages
const publicPages = [
    "",
    "index.html",
    "login.html",
    "register.html",
    "forgot-password.html",
    "reset-password.html",
    "terms.html",
    "privacy.html"
];

if (publicPages.includes(currentPage)) {
    return;
}

window.location.href = "/login.html";

}

// --------------------------------------------
// LOGOUT USER
// --------------------------------------------
async function logoutUser() {
try {
const response = await fetch("${API_URL}/logout.php", {
method: "POST",
credentials: "include",
headers: {
"Accept": "application/json"
}
});

    // Remove locally stored user information
    localStorage.removeItem("crownCashUser");
    localStorage.removeItem("user");
    localStorage.removeItem("loggedIn");

    if (response.ok) {
        window.location.href = "/login.html";
        return;
    }

    // Even if the server returns an error,
    // clear the local session and go to login.
    window.location.href = "/login.html";

} catch (error) {
    console.error("Logout error:", error);

    // Clear local information
    localStorage.removeItem("crownCashUser");
    localStorage.removeItem("user");
    localStorage.removeItem("loggedIn");

    window.location.href = "/login.html";
}

}

// --------------------------------------------
// GET CURRENT USER
// --------------------------------------------
function getCurrentUser() {
try {
const savedUser = localStorage.getItem("crownCashUser");

    if (!savedUser) {
        return null;
    }

    return JSON.parse(savedUser);

} catch (error) {
    console.error("Could not read saved user:", error);
    return null;
}

}

// --------------------------------------------
// PROTECT PAGE
// --------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {

// Do not automatically run on public pages
const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

const publicPages = [
    "",
    "index.html",
    "login.html",
    "register.html",
    "forgot-password.html",
    "reset-password.html",
    "terms.html",
    "privacy.html"
];

if (publicPages.includes(currentPage)) {
    return;
}

// Check the real PHP session
const user = await checkAuth();

if (!user) {
    return;
}

// Make logout buttons work automatically
const logoutButtons = document.querySelectorAll(
    '[data-action="logout"], .logout-btn, #logoutBtn'
);

logoutButtons.forEach(button => {
    button.addEventListener("click", async (event) => {
        event.preventDefault();

        const confirmed = confirm(
            "Are you sure you want to logout?"
        );

        if (confirmed) {
            await logoutUser();
        }
    });
});

});

// --------------------------------------------
// MAKE FUNCTIONS AVAILABLE GLOBALLY
// --------------------------------------------
window.CrownCashAuth = {
checkAuth,
logoutUser,
getCurrentUser,
redirectToLogin
};