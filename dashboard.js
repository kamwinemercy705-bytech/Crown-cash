async function loadDashboard() {

    try {

        const response = await fetch(
            "https://crown-cash1.onrender.com/dashboard.php",
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!data.success) {

            window.location.href = "login.html";
            return;
        }

        const user = data.user;

        /*
        |--------------------------------------------------------------------------
        | Welcome name
        |--------------------------------------------------------------------------
        */

        const welcomeName =
            document.getElementById("welcomeName");

        if (welcomeName) {
            welcomeName.textContent =
                user.firstName || "Member";
        }


        /*
        |--------------------------------------------------------------------------
        | User name in top bar
        |--------------------------------------------------------------------------
        */

        const userName =
            document.getElementById("userName");

        if (userName) {
            userName.textContent =
                user.full_name;
        }


        /*
        |--------------------------------------------------------------------------
        | Account status
        |--------------------------------------------------------------------------
        */

        const accountStatus =
            document.getElementById("accountStatus");

        if (accountStatus) {
            accountStatus.textContent =
                user.status;
        }


        /*
        |--------------------------------------------------------------------------
        | Balance
        |--------------------------------------------------------------------------
        */

        const userBalance =
            document.getElementById("userBalance");

        if (userBalance) {

            userBalance.textContent =
                "UGX " +
                Number(user.balance || 0)
                    .toLocaleString();
        }


        /*
        |--------------------------------------------------------------------------
        | Referral code
        |--------------------------------------------------------------------------
        */

        const referralCode =
            document.getElementById("referralCode");

        if (referralCode) {
            referralCode.textContent =
                user.referralCode || "Not available";
        }


        /*
        |--------------------------------------------------------------------------
        | Email
        |--------------------------------------------------------------------------
        */

        const userEmail =
            document.getElementById("userEmail");

        if (userEmail) {
            userEmail.textContent =
                user.email;
        }


        /*
        |--------------------------------------------------------------------------
        | Phone
        |--------------------------------------------------------------------------
        */

        const userPhone =
            document.getElementById("userPhone");

        if (userPhone) {
            userPhone.textContent =
                user.phone;
        }


        /*
        |--------------------------------------------------------------------------
        | Avatar
        |--------------------------------------------------------------------------
        */

        const avatar =
            document.getElementById("userAvatar");

        if (avatar) {

            avatar.textContent =
                (user.firstName || "U")
                    .charAt(0)
                    .toUpperCase();
        }


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        window.location.href = "login.html";
    }
}


loadDashboard();