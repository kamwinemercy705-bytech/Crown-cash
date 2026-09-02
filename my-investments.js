/*
|--------------------------------------------------------------------------
| Crown Cash — My Investments
|--------------------------------------------------------------------------
*/


const API_URL =
    "https://crown-cash1.onrender.com/investments.php";


/*
|--------------------------------------------------------------------------
| Load page
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", function () {

    setupSidebar();

    setupYear();

    setupLogout();

    loadUserName();

    loadInvestments();

    const retryButton =
        document.getElementById("retryButton");

    if (retryButton) {

        retryButton.addEventListener(
            "click",
            loadInvestments
        );

    }

});


/*
|--------------------------------------------------------------------------
| Sidebar
|--------------------------------------------------------------------------
*/

function setupSidebar() {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");


    if (openSidebar && sidebar) {

        openSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.add("open");

            }
        );

    }


    if (closeSidebar && sidebar) {

        closeSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.remove("open");

            }
        );

    }


    document.addEventListener(
        "click",
        function (event) {

            if (
                window.innerWidth <= 900 &&
                sidebar &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                openSidebar &&
                !openSidebar.contains(event.target)
            ) {

                sidebar.classList.remove("open");

            }

        }
    );

}


/*
|--------------------------------------------------------------------------
| Year
|--------------------------------------------------------------------------
*/

function setupYear() {

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

}


/*
|--------------------------------------------------------------------------
| Load user name
|--------------------------------------------------------------------------
*/

function loadUserName() {

    try {

        const savedUser =
            localStorage.getItem("crowncash_user");

        if (!savedUser) {
            return;
        }

        const user =
            JSON.parse(savedUser);

        const firstName =
            user.firstName || "";

        const lastName =
            user.lastName || "";

        const fullName =
            (firstName + " " + lastName).trim();


        const userName =
            document.getElementById("userName");

        if (userName && fullName) {

            userName.textContent =
                fullName;

        }


        const avatar =
            document.getElementById("userAvatar");

        if (avatar && firstName) {

            avatar.textContent =
                firstName.charAt(0).toUpperCase();

        }

    } catch (error) {

        console.error(
            "Unable to load saved user:",
            error
        );

    }

}


/*
|--------------------------------------------------------------------------
| Load investments from backend
|--------------------------------------------------------------------------
*/

async function loadInvestments() {

    showLoading();

    try {

        const response =
            await fetch(
                API_URL,
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const responseText =
            await response.text();


        console.log(
            "Investments HTTP status:",
            response.status
        );

        console.log(
            "Investments server response:",
            responseText
        );


        let data;

        try {

            data =
                JSON.parse(responseText);

        } catch (error) {

            showError(
                "The server returned an unexpected response."
            );

            return;
        }


        /*
        ----------------------------------------------------------
        Authentication error
        ----------------------------------------------------------
        */

        if (response.status === 401) {

            alert(
                "Your login session has expired. Please login again."
            );

            window.location.href =
                "login.html";

            return;
        }


        /*
        ----------------------------------------------------------
        Other API errors
        ----------------------------------------------------------
        */

        if (!response.ok || !data.success) {

            showError(
                data.message ||
                "Unable to load investments."
            );

            return;
        }


        /*
        ----------------------------------------------------------
        Get investments
        ----------------------------------------------------------
        */

        const investments =
            Array.isArray(data.investments)
                ? data.investments
                : [];


        renderInvestments(
            investments
        );


    } catch (error) {

        console.error(
            "Load investments error:",
            error
        );

        showError(
            "Unable to connect to Crown Cash server."
        );

    }

}


/*
|--------------------------------------------------------------------------
| Render investments
|--------------------------------------------------------------------------
*/

function renderInvestments(
    investments
) {

    hideLoading();

    const list =
        document.getElementById(
            "investmentList"
        );

    const section =
        document.getElementById(
            "investmentsSection"
        );

    const emptyCard =
        document.getElementById(
            "emptyCard"
        );


    /*
    ----------------------------------------------------------
    Summary
    ----------------------------------------------------------
    */

    const totalInvestments =
        document.getElementById(
            "totalInvestments"
        );

    const totalInvested =
        document.getElementById(
            "totalInvested"
        );

    const activeInvestments =
        document.getElementById(
            "activeInvestments"
        );


    const totalAmount =
        investments.reduce(
            function (total, investment) {

                return total +
                    Number(
                        investment.amount || 0
                    );

            },
            0
        );


    const activeCount =
        investments.filter(
            function (investment) {

                return String(
                    investment.status || ""
                ).toLowerCase() === "active";

            }
        ).length;


    if (totalInvestments) {

        totalInvestments.textContent =
            investments.length;

    }


    if (totalInvested) {

        totalInvested.textContent =
            formatCurrency(totalAmount);

    }


    if (activeInvestments) {

        activeInvestments.textContent =
            activeCount;

    }


    /*
    ----------------------------------------------------------
    No investments
    ----------------------------------------------------------
    */

    if (investments.length === 0) {

        if (section) {
            section.style.display = "none";
        }

        if (emptyCard) {
            emptyCard.style.display = "flex";
        }

        return;
    }


    /*
    ----------------------------------------------------------
    Show investment section
    ----------------------------------------------------------
    */

    if (emptyCard) {

        emptyCard.style.display =
            "none";

    }

    if (section) {

        section.style.display =
            "block";

    }


    if (!list) {
        return;
    }


    list.innerHTML = "";


    /*
    ----------------------------------------------------------
    Create investment cards
    ----------------------------------------------------------
    */

    investments.forEach(
        function (investment) {

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "investment-card";


            const plan =
                escapeHTML(
                    investment.plan ||
                    "Investment"
                );


            const amount =
                Number(
                    investment.amount || 0
                );


            const status =
                String(
                    investment.status ||
                    "pending"
                ).toLowerCase();


            const duration =
                investment.duration_days ||
                investment.duration ||
                30;


            const date =
                formatDate(
                    investment.created_at
                );


            const id =
                escapeHTML(
                    investment.id ||
                    "N/A"
                );


            card.innerHTML = `

                <div class="investment-top">

                    <div>

                        <span class="investment-plan">
                            Crown Cash Investment
                        </span>

                        <h4>
                            ${plan}
                        </h4>

                    </div>

                    <span class="status ${getStatusClass(status)}">
                        ${escapeHTML(
                            capitalize(status)
                        )}
                    </span>

                </div>


                <div class="investment-details">

                    <div class="detail">

                        <span>
                            Amount
                        </span>

                        <strong>
                            ${formatCurrency(amount)}
                        </strong>

                    </div>


                    <div class="detail">

                        <span>
                            Duration
                        </span>

                        <strong>
                            ${duration} Days
                        </strong>

                    </div>


                    <div class="detail">

                        <span>
                            Created
                        </span>

                        <strong>
                            ${date}
                        </strong>

                    </div>


                    <div class="detail">

                        <span>
                            Investment ID
                        </span>

                        <strong>
                            ${id}
                        </strong>

                    </div>

                </div>

            `;


            list.appendChild(card);

        }
    );

}


/*
|--------------------------------------------------------------------------
| Format currency
|--------------------------------------------------------------------------
*/

function formatCurrency(amount) {

    return "UGX " +
        Number(amount || 0)
            .toLocaleString(
                "en-UG"
            );

}


/*
|--------------------------------------------------------------------------
| Format date
|--------------------------------------------------------------------------
*/

function formatDate(value) {

    if (!value) {
        return "Not available";
    }


    try {

        /*
        MongoDB may return an ISO date string.
        */

        const date =
            new Date(value);


        if (isNaN(date.getTime())) {

            return "Not available";

        }


        return date.toLocaleDateString(
            "en-UG",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );

    } catch (error) {

        return "Not available";

    }

}


/*
|--------------------------------------------------------------------------
| Status class
|--------------------------------------------------------------------------
*/

function getStatusClass(status) {

    if (status === "active") {
        return "status-active";
    }

    if (status === "pending") {
        return "status-pending";
    }

    if (status === "completed") {
        return "status-completed";
    }

    return "status-default";

}


/*
|--------------------------------------------------------------------------
| Capitalize
|--------------------------------------------------------------------------
*/

function capitalize(value) {

    if (!value) {
        return "";

    }

    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


/*
|--------------------------------------------------------------------------
| Escape HTML
|--------------------------------------------------------------------------
*/

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/*
|--------------------------------------------------------------------------
| Loading state
|--------------------------------------------------------------------------
*/

function showLoading() {

    const loading =
        document.getElementById(
            "loadingCard"
        );

    const error =
        document.getElementById(
            "errorCard"
        );

    const empty =
        document.getElementById(
            "emptyCard"
        );

    const section =
        document.getElementById(
            "investmentsSection"
        );


    if (loading) {
        loading.style.display = "block";
    }

    if (error) {
        error.style.display = "none";
    }

    if (empty) {
        empty.style.display = "none";
    }

    if (section) {
        section.style.display = "none";
    }

}


/*
|--------------------------------------------------------------------------
| Hide loading
|--------------------------------------------------------------------------
*/

function hideLoading() {

    const loading =
        document.getElementById(
            "loadingCard"
        );

    if (loading) {

        loading.style.display =
            "none";

    }

}


/*
|--------------------------------------------------------------------------
| Error state
|--------------------------------------------------------------------------
*/

function showError(message) {

    hideLoading();

    const error =
        document.getElementById(
            "errorCard"
        );

    const errorMessage =
        document.getElementById(
            "errorMessage"
        );


    if (errorMessage) {

        errorMessage.textContent =
            message;

    }

    if (error) {

        error.style.display =
            "flex";

    }

}


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

function setupLogout() {

    const logoutLink =
        document.getElementById(
            "logoutLink"
        );

    if (!logoutLink) {
        return;
    }


    logoutLink.addEventListener(
        "click",
        function () {

            localStorage.removeItem(
                "crowncash_user"
            );

        }
    );

}