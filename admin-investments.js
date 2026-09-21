/* =========================================================
   CROWN CASH ADMIN INVESTMENTS
   Investment Management
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const INVESTMENTS_API =
    `${API_BASE}/admin-investments.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   STATE
   ========================================================= */

let investments = [];

let filteredInvestments = [];

let selectedInvestment = null;


/* =========================================================
   DOM
   ========================================================= */

const investmentTableBody =
    document.getElementById("investmentTableBody");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const planFilter =
    document.getElementById("planFilter");

const refreshBtn =
    document.getElementById("refreshBtn");

const resultCount =
    document.getElementById("resultCount");

const investmentModal =
    document.getElementById("investmentModal");

const closeModal =
    document.getElementById("closeModal");

const closeDetailsBtn =
    document.getElementById("closeDetailsBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatMoney(value) {

    const number = Number(value) || 0;

    return `UGX ${number.toLocaleString("en-US", {
        maximumFractionDigits: 2
    })}`;
}


function formatNumber(value) {

    const number = Number(value) || 0;

    return number.toLocaleString("en-US");
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function normalizeStatus(value) {

    const status =
        String(value || "pending")
            .trim()
            .toLowerCase();

    if (
        status === "approved" ||
        status === "running"
    ) {
        return "active";
    }

    if (
        status === "complete" ||
        status === "finished"
    ) {
        return "completed";
    }

    if (
        status === "rejected" ||
        status === "declined"
    ) {
        return "cancelled";
    }

    return status;
}


function normalizePlan(value) {

    const plan =
        String(value || "")
            .trim()
            .toLowerCase();

    if (plan.includes("starter")) {
        return "starter";
    }

    if (plan.includes("standard")) {
        return "standard";
    }

    if (plan.includes("advanced")) {
        return "advanced";
    }

    return plan || "unknown";
}


function getInitials(name) {

    const clean =
        String(name || "User")
            .trim();

    if (!clean) {
        return "U";
    }

    const parts =
        clean.split(/\s+/);

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
   TOAST
   ========================================================= */

let toastTimer = null;


function showToast(
    title,
    message,
    type = "success"
) {

    const toast =
        document.getElementById("toast");

    const toastTitle =
        document.getElementById("toastTitle");

    const toastMessage =
        document.getElementById("toastMessage");

    const toastIcon =
        document.getElementById("toastIcon");

    if (!toast) {
        return;
    }

    toastTitle.textContent =
        title || "Notification";

    toastMessage.textContent =
        message || "";

    if (toastIcon) {

        if (type === "error") {

            toastIcon.style.color =
                "#ff4f6d";

            toastIcon.style.borderColor =
                "rgba(255,79,109,.25)";

            toastIcon.style.background =
                "rgba(255,79,109,.08)";

        } else {

            toastIcon.style.color =
                "#28e28a";

            toastIcon.style.borderColor =
                "rgba(40,226,138,.18)";

            toastIcon.style.background =
                "rgba(40,226,138,.08)";
        }
    }

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {

    investmentTableBody.innerHTML = `
        <tr>
            <td colspan="8">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <span>
                        Loading investments...
                    </span>
                </div>
            </td>
        </tr>
    `;
}


function showEmpty(message = "No investments found.") {

    investmentTableBody.innerHTML = `
        <tr>
            <td colspan="8">
                <div class="empty-state">

                    <svg viewBox="0 0 24 24">
                        <rect
                            x="4"
                            y="4"
                            width="16"
                            height="16"
                            rx="3"
                        />
                        <path d="M8 15l3-4 3 2 3-5"/>
                    </svg>

                    <span>
                        ${escapeHTML(message)}
                    </span>

                </div>
            </td>
        </tr>
    `;
}


function showError(message) {

    investmentTableBody.innerHTML = `
        <tr>
            <td colspan="8">
                <div class="error-state">

                    <svg viewBox="0 0 24 24">
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        />
                        <path d="M12 8v5"/>
                        <path d="M12 16h.01"/>
                    </svg>

                    <span>
                        ${escapeHTML(message)}
                    </span>

                    <button
                        type="button"
                        class="view-btn"
                        onclick="loadInvestments()"
                    >
                        Try Again
                    </button>

                </div>
            </td>
        </tr>
    `;
}


/* =========================================================
   NORMALIZE BACKEND RECORD
   ========================================================= */

function normalizeInvestment(item) {

    const user =
        item.user ||
        item.customer ||
        {};

    const customerName =
        item.full_name ||
        item.fullName ||
        item.name ||
        item.customer_name ||
        item.customerName ||
        user.full_name ||
        user.fullName ||
        user.name ||
        "Unknown User";

    const email =
        item.email ||
        user.email ||
        "";

    const phone =
        item.phone ||
        user.phone ||
        "";

    const plan =
        normalizePlan(
            item.plan ||
            item.plan_name ||
            item.planName ||
            item.package
        );

    const amount =
        Number(
            item.amount ??
            item.investment_amount ??
            item.investmentAmount ??
            0
        ) || 0;

    const status =
        normalizeStatus(
            item.status
        );

    const duration =
        Number(
            item.duration ??
            item.duration_days ??
            item.durationDays ??
            30
        ) || 30;

    const startDate =
        item.start_date ||
        item.startDate ||
        item.started_at ||
        item.startedAt ||
        "";

    const endDate =
        item.end_date ||
        item.endDate ||
        item.maturity_date ||
        item.maturityDate ||
        "";

    const createdAt =
        item.created_at ||
        item.createdAt ||
        "";

    const recordedReturn =
        Number(
            item.return_amount ??
            item.returnAmount ??
            item.earnings ??
            item.profit ??
            item.total_return ??
            item.totalReturn ??
            0
        ) || 0;

    const id =
        item._id ||
        item.id ||
        item.investment_id ||
        item.investmentId ||
        "";

    return {

        id: String(id),

        customerName:
            String(customerName),

        email:
            String(email),

        phone:
            String(phone),

        plan,

        amount,

        status,

        duration,

        startDate,

        endDate,

        createdAt,

        recordedReturn
    };
}


/* =========================================================
   LOAD INVESTMENTS
   ========================================================= */

async function loadInvestments() {

    showLoading();

    if (refreshBtn) {

        refreshBtn.classList.add("loading");

        refreshBtn.disabled = true;
    }

    try {

        const response =
            await fetch(
                INVESTMENTS_API,
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        let data = null;

        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "The server returned an invalid response."
            );
        }


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                data?.message ||
                "Administrator access is required."
            );
        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to load investments."
            );
        }


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load investments."
            );
        }


        const records =
            Array.isArray(data.investments)
                ? data.investments
                : Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data.records)
                        ? data.records
                        : [];


        investments =
            records.map(
                normalizeInvestment
            );


        filteredInvestments =
            [...investments];


        updateStatistics();

        applyFilters();


        if (data.admin) {

            updateAdminDetails(
                data.admin
            );
        }


    } catch (error) {

        console.error(
            "Investment loading error:",
            error
        );

        investments = [];

        filteredInvestments = [];

        updateStatistics();

        resultCount.textContent = "0";

        showError(
            error.message ||
            "Unable to load investments."
        );

        showToast(
            "Unable to load",
            error.message ||
            "Please try again.",
            "error"
        );

    } finally {

        if (refreshBtn) {

            refreshBtn.classList.remove(
                "loading"
            );

            refreshBtn.disabled = false;
        }
    }
}


/* =========================================================
   ADMIN DETAILS
   ========================================================= */

function updateAdminDetails(admin) {

    const adminName =
        document.getElementById("adminName");

    const adminEmail =
        document.getElementById("adminEmail");

    const adminAvatar =
        document.getElementById("adminAvatar");


    const name =
        admin.name ||
        admin.full_name ||
        admin.fullName ||
        "Administrator";


    const email =
        admin.email ||
        "Admin Account";


    if (adminName) {

        adminName.textContent =
            name;
    }


    if (adminEmail) {

        adminEmail.textContent =
            email;
    }


    if (adminAvatar) {

        adminAvatar.textContent =
            getInitials(name);
    }
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const total =
        investments.length;

    const active =
        investments.filter(
            item => item.status === "active"
        ).length;

    const pending =
        investments.filter(
            item => item.status === "pending"
        ).length;

    const completed =
        investments.filter(
            item => item.status === "completed"
        ).length;


    const totalInvested =
        investments.reduce(
            (sum, item) =>
                sum + Number(item.amount || 0),
            0
        );


    const activeCapital =
        investments
            .filter(
                item =>
                    item.status === "active"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );


    const pendingCapital =
        investments
            .filter(
                item =>
                    item.status === "pending"
            )
            .reduce(
                (sum, item) =>
                    sum + Number(item.amount || 0),
                0
            );


    const totalReturns =
        investments.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.recordedReturn || 0
                ),
            0
        );


    setText(
        "totalInvestments",
        formatNumber(total)
    );

    setText(
        "activeInvestments",
        formatNumber(active)
    );

    setText(
        "pendingInvestments",
        formatNumber(pending)
    );

    setText(
        "completedInvestments",
        formatNumber(completed)
    );


    setText(
        "totalInvestedAmount",
        formatMoney(totalInvested)
    );

    setText(
        "activeCapital",
        formatMoney(activeCapital)
    );

    setText(
        "pendingCapital",
        formatMoney(pendingCapital)
    );

    setText(
        "totalReturns",
        formatMoney(totalReturns)
    );
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;
    }
}


/* =========================================================
   FILTERING
   ========================================================= */

function applyFilters() {

    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedStatus =
        String(
            statusFilter?.value || "all"
        )
            .toLowerCase();


    const selectedPlan =
        String(
            planFilter?.value || "all"
        )
            .toLowerCase();


    filteredInvestments =
        investments.filter(item => {

            const searchableText =
                [
                    item.customerName,
                    item.email,
                    item.phone,
                    item.plan,
                    item.status,
                    item.id
                ]
                    .join(" ")
                    .toLowerCase();


            const matchesSearch =
                !search ||
                searchableText.includes(search);


            const matchesStatus =
                selectedStatus === "all" ||
                item.status === selectedStatus;


            const matchesPlan =
                selectedPlan === "all" ||
                item.plan === selectedPlan;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesPlan
            );
        });


    resultCount.textContent =
        formatNumber(
            filteredInvestments.length
        );


    renderInvestments(
        filteredInvestments
    );
}


/