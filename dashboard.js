async function loadDashboard() {

    try {

        const response =
            await fetch("php/dashboard.php");

        const data =
            await response.json();

        if (!data.success) {

            window.location.href = "login.html";
            return;
        }

        const user = data.user;

        const nameElement =
            document.getElementById("userName");

        const balanceElement =
            document.getElementById("userBalance");

        if (nameElement) {
            nameElement.textContent =
                user.full_name;
        }

        if (balanceElement) {
            balanceElement.textContent =
                "UGX " +
                Number(user.balance).toLocaleString();
        }

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }
}

loadDashboard();
