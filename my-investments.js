<!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="theme-color" content="#07111f">

<title>Crown Cash | My Investments</title>

<!-- Font Awesome -->
<link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
>

<!-- Main CSS -->
<link rel="stylesheet" href="my-investments.css">

</head><body><div class="app"><!-- ==========================================
     SIDEBAR
=========================================== -->
<aside class="sidebar" id="sidebar">

    <div class="sidebar-logo">
        <div class="logo-mark">C</div>

        <div class="logo-text">
            <strong>Crown</strong>
            <span>Cash</span>
        </div>
    </div>

    <div class="sidebar-user">

        <div class="user-avatar">
            <i class="fa-solid fa-user"></i>
        </div>

        <div class="user-details">
            <strong id="sidebarUserName">
                Crown Cash User
            </strong>

            <span id="sidebarUserStatus">
                Active Account
            </span>
        </div>

    </div>

    <nav class="sidebar-nav">

        <a href="/dashboard.html">
            <i class="fa-solid fa-gauge-high"></i>
            <span>Dashboard</span>
        </a>

        <a href="/profile.html">
            <i class="fa-solid fa-user"></i>
            <span>Profile</span>
        </a>

        <a href="/investments.html">
            <i class="fa-solid fa-chart-line"></i>
            <span>Investment Plans</span>
        </a>

        <a
            href="/my-investments.html"
            class="active"
        >
            <i class="fa-solid fa-briefcase"></i>
            <span>My Investments</span>
        </a>

        <a href="/deposit.html">
            <i class="fa-solid fa-circle-arrow-down"></i>
            <span>Deposits</span>
        </a>

        <a href="/withdraw.html">
            <i class="fa-solid fa-circle-arrow-up"></i>
            <span>Withdrawals</span>
        </a>

        <a href="/team.html">
            <i class="fa-solid fa-users"></i>
            <span>Referral Team</span>
        </a>

        <a href="/transactions.html">
            <i class="fa-solid fa-receipt"></i>
            <span>Transactions</span>
        </a>

        <a href="/support.html">
            <i class="fa-solid fa-headset"></i>
            <span>Support</span>
        </a>

    </nav>

    <button
        type="button"
        class="logout-btn"
        id="logoutBtn"
    >
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>Logout</span>
    </button>

</aside>


<!-- ==========================================
     MOBILE OVERLAY
=========================================== -->
<div
    class="sidebar-overlay"
    id="sidebarOverlay"
></div>


<!-- ==========================================
     MAIN CONTENT
=========================================== -->
<main class="main-content">

    <!-- TOPBAR -->
    <header class="topbar">

        <button
            type="button"
            class="menu-toggle"
            id="menuToggle"
            aria-label="Open menu"
        >
            <i class="fa-solid fa-bars"></i>
        </button>

        <div class="page-heading">

            <div class="heading-icon">
                <i class="fa-solid fa-briefcase"></i>
            </div>

            <div>
                <h1>My Investments</h1>

                <p>
                    View and manage your investment requests
                </p>
            </div>

        </div>

    </header>


    <!-- ==========================================
         PAGE BODY
    =========================================== -->
    <section class="page-container">

        <!-- BALANCE -->
        <div class="balance-card">

            <div class="balance-left">

                <div class="balance-icon">
                    <i class="fa-solid fa-wallet"></i>
                </div>

                <div>
                    <span>Available Balance</span>

                    <h2 id="availableBalance">
                        UGX 0
                    </h2>
                </div>

            </div>

            <a
                href="/deposit.html"
                class="balance-btn"
            >
                <i class="fa-solid fa-plus"></i>
                Deposit
            </a>

        </div>


        <!-- ======================================
             SUMMARY
        ======================================= -->
        <div class="summary-grid">

            <div class="summary-card">

                <div class="summary-icon purple">
                    <i class="fa-solid fa-chart-line"></i>
                </div>

                <div>
                    <span>Total Investments</span>

                    <strong id="totalInvestments">
                        0
                    </strong>
                </div>

            </div>


            <div class="summary-card">

                <div class="summary-icon green">
                    <i class="fa-solid fa-circle-check"></i>
                </div>

                <div>
                    <span>Active</span>

                    <strong id="activeInvestments">
                        0
                    </strong>
                </div>

            </div>


            <div class="summary-card">

                <div class="summary-icon orange">
                    <i class="fa-solid fa-clock"></i>
                </div>

                <div>
                    <span>Pending</span>

                    <strong id="pendingInvestments">
                        0
                    </strong>
                </div>

            </div>


            <div class="summary-card">

                <div class="summary-icon blue">
                    <i class="fa-solid fa-coins"></i>
                </div>

                <div>
                    <span>Total Invested</span>

                    <strong id="totalInvested">
                        UGX 0
                    </strong>
                </div>

            </div>

        </div>


        <!-- ======================================
             MESSAGE
        ======================================= -->
        <div
            id="investmentMessage"
            class="investment-message"
            style="display:none;"
        ></div>


        <!-- ======================================
             INVESTMENT LIST HEADER
        ======================================= -->
        <div class="section-header">

            <div>

                <h2>
                    <i class="fa-solid fa-layer-group"></i>
                    Investment History
                </h2>

                <p>
                    Your investment requests and their current status
                </p>

            </div>

            <a
                href="/investments.html"
                class="new-investment-btn"
            >
                <i class="fa-solid fa-plus"></i>
                New Investment
            </a>

        </div>


        <!-- ======================================
             FILTERS
        ======================================= -->
        <div class="filters">

            <button
                type="button"
                class="filter-btn active"
                data-filter="all"
            >
                <i class="fa-solid fa-layer-group"></i>
                All
            </button>

            <button
                type="button"
                class="filter-btn"
                data-filter="pending"
            >
                <i class="fa-solid fa-clock"></i>
                Pending
            </button>

            <button
                type="button"
                class="filter-btn"
                data-filter="active"
            >
                <i class="fa-solid fa-circle-check"></i>
                Active
            </button>

            <button
                type="button"
                class="filter-btn"
                data-filter="completed"
            >
                <i class="fa-solid fa-flag-checkered"></i>
                Completed
            </button>

        </div>


        <!-- ======================================
             LOADING
        ======================================= -->
        <div
            class="state-box"
            id="loadingState"
        >

            <div class="loading-spinner">
                <i class="fa-solid fa-spinner fa-spin"></i>
            </div>

            <h3>Loading investments...</h3>

            <p>
                Please wait while we retrieve your investments.
            </p>

        </div>


        <!-- ======================================
             ERROR
        ======================================= -->
        <div
            class="state-box error-state"
            id="errorState"
            style="display:none;"
        >

            <div class="state-icon">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>

            <h3>Unable to load investments</h3>

            <p id="errorMessage">
                Please refresh the page and try again.
            </p>

            <button
                type="button"
                id="retryBtn"
                class="retry-btn"
            >
                <i class="fa-solid fa-rotate-right"></i>
                Try Again
            </button>

        </div>


        <!-- ======================================
             EMPTY
        ======================================= -->
        <div
            class="state-box empty-state"
            id="emptyState"
            style="display:none;"
        >

            <div class="state-icon">
                <i class="fa-solid fa-chart-line"></i>
            </div>

            <h3>No investments yet</h3>

            <p>
                You have not submitted an investment request yet.
            </p>

            <a
                href="/investments.html"
                class="empty-action-btn"
            >
                <i class="fa-solid fa-rocket"></i>
                View Investment Plans
            </a>

        </div>


        <!-- ======================================
             INVESTMENTS
        ======================================= -->
        <div
            class="investment-list"
            id="investmentList"
        ></div>


    </section>


    <!-- ==========================================
         FOOTER
    =========================================== -->
    <footer class="footer">

        <p>
            © <span id="currentYear"></span>
            Crown Cash. All rights reserved.
        </p>

        <div class="footer-links">
            <a href="/terms.html">
                Terms
            </a>

            <a href="/privacy.html">
                Privacy
            </a>

            <a href="/support.html">
                Support
            </a>
        </div>

    </footer>

</main>

</div><!-- JavaScript --><script src="my-investments.js"></script></body>
</html>