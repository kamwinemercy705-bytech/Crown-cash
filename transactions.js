async function loadTransactions() {

    try {

        const response =
            await fetch("php/transactions.php");

        const data =
            await response.json();

        if (!data.success) {
            console.error(data.message);
            return;
        }

        console.log(
            "Transactions:",
            data.transactions
        );

        /*
         * Use data.transactions to populate
         * the transaction table already in
         * transactions.html.
         */

    } catch (error) {

        console.error(
            "Transaction loading error:",
            error
        );
    }
}

loadTransactions();
