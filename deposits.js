if (method) {

    method.addEventListener("change", function () {

        if (method.value === "mtn") {

            paymentInfo.innerHTML = `
                <div class="info-icon">M</div>

                <div>
                    <strong>MTN Mobile Money</strong>

                    <p>
                        Dial <strong>*165*3#</strong>,
                        select Merchant Code and enter
                        the official Crown Cash MTN
                        merchant code.
                    </p>

                    <p class="merchant-placeholder">
                        Merchant Code:
                        <strong>YOUR-MTN-CODE</strong>
                    </p>

                </div>
            `;

        }


        else if (method.value === "airtel") {

            paymentInfo.innerHTML = `
                <div class="info-icon">A</div>

                <div>
                    <strong>Airtel Money</strong>

                    <p>
                        Select the Airtel Money merchant
                        payment option and enter the
                        official Crown Cash Airtel
                        merchant code.
                    </p>

                    <p class="merchant-placeholder">
                        Merchant Code:
                        <strong>YOUR-AIRTEL-CODE</strong>
                    </p>

                </div>
            `;

        }


        else {

            paymentInfo.innerHTML = `
                <div class="info-icon">i</div>

                <p>
                    Select MTN Mobile Money or Airtel Money
                    to view payment instructions.
                </p>
            `;

        }

    });

}