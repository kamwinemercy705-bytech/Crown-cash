/* =========================================================
   CROWN CASH — ADMIN INVESTMENTS
   ========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";


/* =========================================================
   ELEMENTS
   ========================================================= */

const adminSidebar =
    document.getElementById("adminSidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

const menuBtn =
    document.getElementById("menuBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const refreshBtn =
    document.getElementById("refreshBtn");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const investmentTableBody =
    document.getElementById("investmentTableBody");

const loadingState =
    document.getElementById("loadingState");

const emptyState =
    document.getElementById("emptyState");

const errorMessage =
    document.getElementById("errorMessage");

const pagination =
    document.getElementById("pagination");

const paginationInfo =
    document.getElementById("paginationInfo");


/* =========================================================
   ADMIN INFORMATION
   ========================================================= */

const adminName =
    document.getElementById("adminName");

const adminAvatar =
    document.getElementById("adminAvatar");


/* =========================================================
   STATISTICS
   ========================================================= */

const totalInvestments =
    document.getElementById("totalInvestments");

const totalAmount =
    document.getElementById("totalAmount");

const activeInvestments =
    document.getElementById("activeInvestments");

const completedInvestments =
    document.getElementById("completedInvestments");


/* =========================================================
   DATA
   ========================================================= */

let allInvestments = [];


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openSidebar() {

    if (adminSidebar) {
        adminSidebar.classList.add("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.add("show");
    }
}


function closeSidebar() {

    if (adminSidebar) {
        adminSidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
    }
}


if (menuBtn) {

    menuBtn.addEventListener(
        "click",
        openSidebar
    );
}


if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}


/* =========================================================
   ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {
            closeSidebar();
        }

    }
);


/* =========================================================
   FORMAT MONEY
   ========================================================= */

function formatMoney(amount) {

    const number =
        Number(amount) || 0;

    return new Intl.NumberFormat(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    ).format(number);
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    const date =
        new Date(dateValue);

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

    const cleanName =
        String(name || "")
            .trim();

    if (!cleanName) {
        return "U";
    }

    const parts =
        cleanName
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
   ESCAPE HTML
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
   SHOW ERROR
   ========================================================= */

function showError(message) {

    if (!errorMessage) {
        return;
    }

    errorMessage.textContent =
        message || "Something went wrong.";

    errorMessage.classList.add("show");
}


/* =========================================================
   HIDE ERROR
   ========================================================= */

function hideError() {

    if (!errorMessage) {
        return;
    }

    errorMessage.textContent = "";

    errorMessage.classList.remove("show");
}


/* =========================================================
   LOADING
   ========================================================= */

function setLoading(isLoading) {

    if (loadingState) {

        loadingState.style.display =
            isLoading ? "flex" : "none";
    }

}


/* =========================================================
   UPDATE ADMIN
   ========================================================= */

function updateAdminInfo(admin) {

    if (!admin) {
        return;
    }

    const name =
        admin.name || "Administrator";

    if (adminName) {
        adminName.textContent = name;
    }

    if (adminAvatar) {
        adminAvatar.textContent =
            getInitials(name);
    }
}


/* =========================================================
   UPDATE STATISTICS
   ========================================================= */

function updateStats(stats) {

    const data =
        stats || {};

    if (totalInvestments) {

        totalInvestments.textContent =
            formatMoney(
                data.total_investments || 0
            );
    }


    if (totalAmount) {

        totalAmount.textContent =
            "UGX " +
            formatMoney(
                data.total_amount || 0
            );
    }


    if (activeInvestments) {

        activeInvestments.textContent =
            formatMoney(
                data.active || 0
            );
    }


    if (completedInvestments) {

        completedInvestments.textContent =
            formatMoney(
                data.completed || 0
            );
    }
}


/* =========================================================
   LOAD INVESTMENTS
   ========================================================= */

async function loadInvestments() {

    hideError();

    setLoading(true);

    if (emptyState) {
        emptyState.style.display = "none";
    }

    if (pagination) {
        pagination.style.display = "none";
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/admin_investments.php`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch (error) {

            console.error(
                "Invalid server response:",
                text
            );

            throw new Error(
                "The server returned an invalid response."
            );
        }


        if (
            response.status === 401
        ) {

            window.location.href =
                "login.html";

            return;
        }


        if (
            response.status === 403
        ) {

            throw new Error(
                data.message ||
                "Administrator access required."
            );
        }


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to load investments."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Save Data
        |--------------------------------------------------------------------------
        */

        allInvestments =
            Array.isArray(data.investments)
                ? data.investments
                : [];


        /*
        |--------------------------------------------------------------------------
        | Admin
        |--------------------------------------------------------------------------
        */

        updateAdminInfo(
            data.admin
        );


        /*
        |--------------------------------------------------------------------------
        | Statistics
        |--------------------------------------------------------------------------
        */

        updateStats(
            data.stats
        );


        /*
        |--------------------------------------------------------------------------
        | Render
        |--------------------------------------------------------------------------
        */

        renderInvestments();


    } catch (error) {

        console.error(
            "Admin investment error:",
            error
        );

        showError(
            error.message ||
            "Unable to load investments."
        );

        allInvestments = [];

        renderInvestments();

    } finally {

        setLoading(false);
    }
}


/* =========================================================
   FILTER INVESTMENTS
   ========================================================= */

function getFilteredInvestments() {

    const search =
        (
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const status =
        statusFilter?.value || "all";


    return allInvestments.filter(
        function (investment) {

            const user =
                investment.user || {};


            const name =
                String(
                    user.name || ""
                ).toLowerCase();


            const email =
                String(
                    user.email || ""
                ).toLowerCase();


            const phone =
                String(
                    user.phone || ""
                ).toLowerCase();


            const plan =
                String(
                    investment.plan || ""
                ).toLowerCase();


            const investmentStatus =
                String(
                    investment.status || ""
                ).toLowerCase();


            const matchesSearch =
                !search ||
                name.includes(search) ||
                email.includes(search) ||
                phone.includes(search) ||
                plan.includes(search);


            const matchesStatus =
                status === "all" ||
                investmentStatus === status;


            return (
                matchesSearch &&
                matchesStatus
            );
        }
    );
}


/* =========================================================
   RENDER INVESTMENTS
   ========================================================= */

function renderInvestments() {

    const investments =
        getFilteredInvestments();


    if (!investmentTableBody) {
        return;
    }


    investmentTableBody.innerHTML = "";


    /*
    |--------------------------------------------------------------------------
    | Empty State
    |--------------------------------------------------------------------------
    */

    if (
        investments.length === 0
    ) {

        if (emptyState) {
            emptyState.style.display =
                "block";
        }

        if (pagination) {
            pagination.style.display =
                "none";
        }

        return;
    }


    if (emptyState) {
        emptyState.style.display =
            "none";
    }


    /*
    |--------------------------------------------------------------------------
    | Create Rows
    |--------------------------------------------------------------------------
    */

    investments.forEach(
        function (investment) {

            const user =
                investment.user || {};


            const userName =
                user.name ||
                "Unknown User";


            const email =
                user.email ||
                "—";


            const phone =
                user.phone ||
                "—";


            const plan =
                investment.plan ||
                "—";


            const amount =
                Number(
                    investment.amount || 0
                );


            const duration =
                Number(
                    investment.duration_days ||
                    30
                );


            const status =
                String(
                    investment.status ||
                    "unknown"
                ).toLowerCase();


            const type =
                investment.type ||
                "test";


            const created =
                formatDate(
                    investment.created_at
                );


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>

                    <div class="user-cell">

                        <div class="user-mini-avatar">
                            ${escapeHtml(
                                getInitials(
                                    userName
                                )
                            )}
                        </div>

                        <div class="user-details">

                            <strong>
                                ${escapeHtml(
                                    userName
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    email
                                )}
                            </span>

                        </div>

                    </div>

                </td>


                <td>

                    <span class="plan-name">
                        ${escapeHtml(
                            plan
                        )}
                    </span>

                </td>


                <td class="amount-cell">

                    UGX
                    ${formatMoney(
                        amount
                    )}

                </td>


                <td class="duration-cell">

                    ${duration}
                    day${duration === 1 ? "" : "s"}

                </td>


                <td>

                    <span
                        class="status-badge ${getStatusClass(status)}"
                    >
                        ${escapeHtml(
                            capitalize(status)
                        )}
                    </span>

                </td>


                <td>

                    <span class="type-badge">
                        ${escapeHtml(
                            type
                        )}
                    </span>

                </td>


                <td class="date-cell">

                    ${escapeHtml(
                        created
                    )}

                </td>

            `;


            investmentTableBody.appendChild(
                row
            );

        }
    );


    /*
    |--------------------------------------------------------------------------
    | Pagination Information
    |--------------------------------------------------------------------------
    */

    if (pagination) {
        pagination.style.display =
            "block";
    }


    if (paginationInfo) {

        paginationInfo.textContent =
            `Showing ${investments.length} investment${
                investments.length === 1
                    ? ""
                    : "s"
            }`;
    }
}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function getStatusClass(status) {

    if (
        status === "active"
    ) {
        return "active";
    }

    if (
        status === "pending"
    ) {
        return "pending";
    }

    if (
        status === "completed"
    ) {
        return "completed";
    }

    return "other";
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
   SEARCH
   ========================================================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        renderInvestments
    );
}


/* =========================================================
   FILTER
   ========================================================= */

if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        renderInvestments
    );
}


/* =========================================================
   REFRESH
   ========================================================= */

if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        loadInvestments
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

            const confirmed =
                confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmed) {
                return;
            }


            try {

                await fetch(
                    `${API_BASE}/logout.php`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            } finally {

                localStorage.removeItem(
                    "crowncash_user"
                );

                window.location.href =
                    "login.html";
            }

        }
    );
}


/* =========================================================
   INITIAL LOAD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadInvestments();

    }
);