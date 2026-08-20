async function loadInvestments() {

    try {

        const response =
            await fetch("php/investments.php");

        const data =
            await response.json();

        if (!data.success) {
            console.error(data.message);
            return;
        }

        console.log(
            "Investments:",
            data.investments
        );

        /*
         * Connect these results to the
         * investment cards/table already
         * present in your investments.html.
         */

    } catch (error) {

        console.error(
            "Unable to load investments:",
            error
        );

    }
}

loadInvestments();
