/* ============================================================
   CROWN CASH
   DEPOSIT PAGE JAVASCRIPT
   Production Version
   ============================================================ */

"use strict";


/* ============================================================
   API CONFIGURATION
   ============================================================ */

const API_BASE =
    "https://crown-cash1.onrender.com";


const DEPOSIT_API =
    `${API_BASE}/deposit.php`;


/* ============================================================
   MERCHANT CODES
   ============================================================ */

const MERCHANT_CODES = {

    mtn:
        "80257065",

    airtel:
        "7229487"

};


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const depositForm =
    document.getElementById(
        "depositForm"
    );


const amountInput =
    document.getElementById(
        "amount"
    );


const transactionReferenceInput =
    document.getElementById(
        "transactionReference"
    );


const depositButton =
    document.getElementById(
        "depositButton"
    );


const formMessage =
    document.getElementById(
        "formMessage"
    );


const merchantCode =
    document.getElementById(
        "merchantCode"
    );


const copyMerchantCode =
    document.getElementById(
        "copyMerchantCode"
    );


const paymentDetailsTitle =
    document.getElementById(
        "paymentDetailsTitle"
    );


const paymentDetailsText =
    document.getElementById(
        "paymentDetailsText"
    );


const availableBalance =
    document.getElementById(
        "availableBalance"
    );


const depositHistory =
    document.getElementById(
        "depositHistory"
    );


const mtnRadio =
    document.getElementById(
        "mtn"
    );


const airtelRadio =
    document.getElementById(
        "airtel"
    );


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* ============================================================
   FORMAT UGX
   ============================================================ */

function formatUGX(
    amount
) {

    const number =
        Number(amount);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "UGX 0";
    }


    return (
        "UGX " +
        number.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits:
                    0
            }
        )
    );
}


/* ============================================================
   MESSAGE
   ============================================================ */

function showMessage(
    message,
    type = "error"
) {

    if (!formMessage) {

        return;
    }


    formMessage.textContent =
        message;


    formMessage.classList.add(
        "show"
    );


    formMessage.style.display =
        "block";


    if (
        type === "success"
    ) {

        formMessage.style.color =
            "#b8f3d1";

        formMessage.style.background =
            "rgba(53, 208, 127, 0.10)";

        formMessage.style.border =
            "1px solid rgba(53, 208, 127, 0.20)";


    } else if (
        type === "warning"
    ) {

        formMessage.style.color =
            "#ffe5a3";

        formMessage.style.background =
            "rgba(245, 185, 66, 0.10)";

        formMessage.style.border =
            "1px solid rgba(245, 185, 66, 0.20)";


    } else {

        formMessage.style.color =
            "#ffd1d8";

        formMessage.style.background =
            "rgba(255, 91, 112, 0.10)";

        formMessage.style.border =
            "1px solid rgba(255, 91, 112, 0.20)";
    }
}


/* ============================================================
   HIDE MESSAGE
   ============================================================ */

function hideMessage() {

    if (!formMessage) {

        return;
    }


    formMessage.textContent =
        "";


    formMessage.classList.remove(
        "show"
    );


    formMessage.style.display =
        "none";
}


/* ============================================================
   SELECTED PAYMENT METHOD
   ============================================================ */

function getSelectedPaymentMethod() {

    if (
        mtnRadio &&
        mtnRadio.checked
    ) {

        return "mtn";
    }


    if (
        airtelRadio &&
        airtelRadio.checked
    ) {

        return "airtel";
    }


    return "";
}


/* ============================================================
   PAYMENT DETAILS
   ============================================================ */

function updatePaymentDetails(
    method
) {

    if (!method) {

        method =
            "mtn";
    }


    const code =
        MERCHANT_CODES[
            method
        ];


    if (!code) {

        return;
    }


    if (merchantCode) {

        merchantCode.textContent =
            code;
    }


    if (
        method === "mtn"
    ) {

        if (paymentDetailsTitle) {

            paymentDetailsTitle.textContent =
                "MTN MOBILE MONEY PAYMENT";
        }


        if (paymentDetailsText) {

            paymentDetailsText.innerHTML =
                'Send your deposit to the Crown Cash MTN Mobile Money ' +
                'merchant account using the merchant code below. ' +
                'Dial <strong class="ussd">*165*3#</strong> on your MTN line, ' +
                'select the merchant payment option, enter merchant code ' +
                '<strong>80257065</strong>, enter the amount and confirm.';
        }


        return;
    }


    if (
        method === "airtel"
    ) {

        if (paymentDetailsTitle) {

            paymentDetailsTitle.textContent =
                "AIRTEL MONEY PAYMENT";
        }


        if (paymentDetailsText) {

            paymentDetailsText.innerHTML =
                'Send your deposit to the Crown Cash Airtel Money ' +
                'merchant account using the merchant code below. ' +
                'Open Airtel Money, select the merchant/business payment ' +
                'option, enter merchant code <strong>7229487</strong>, ' +
                'enter the amount and confirm the payment.';
        }
    }
}


/* ============================================================
   COPY MERCHANT CODE
   ============================================================ */

async function copyMerchantCodeToClipboard() {

    const method =
        getSelectedPaymentMethod();


    const code =
        MERCHANT_CODES[
            method
        ];


    if (!code) {

        return;
    }


    try {

        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText ===
                "function"
        ) {

            await navigator.clipboard.writeText(
                code
            );


        } else {

            const temporaryInput =
                document.createElement(
                    "input"
                );


            temporaryInput.value =
                code;


            temporaryInput.style.position =
                "fixed";


            temporaryInput.style.opacity =
                "0";


            document.body.appendChild(
                temporaryInput
            );


            temporaryInput.focus();

            temporaryInput.select();


            document.execCommand(
                "copy"
            );


            temporaryInput.remove();
        }


        if (copyMerchantCode) {

            const originalHTML =
                copyMerchantCode.innerHTML;


            copyMerchantCode.innerHTML = `
                <svg viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="1.8">
                    <path d="M5 12l4 4L19 6"></path>
                </svg>

                <span>Copied</span>
            `;


            setTimeout(
                () => {

                    copyMerchantCode.innerHTML =
                        originalHTML;

                },
                1600
            );
        }


    } catch (error) {

        console.error(
            "Merchant code copy failed:",
            error
        );
    }
}


/* ============================================================
   READ API RESPONSE
   ============================================================ */

async function readAPIResponse(
    response
) {

    const rawText =
        await response.text();


    const cleanedText =
        rawText.trim();


    if (
        !cleanedText
    ) {

        return {

            ok:
                response.ok,

            status:
                response.status,

            data:
                null,

            raw:
                "",

            error:
                `The server returned an empty response (HTTP ${response.status}).`

        };
    }


    try {

        const data =
            JSON.parse(
                cleanedText
            );


        return {

            ok:
                response.ok,

            status:
                response.status,

            data:
                data,

            raw:
                cleanedText,

            error:
                null

        };


    } catch (error) {

        console.error(
            "Backend returned invalid JSON:",
            cleanedText
        );


        return {

            ok:
                response.ok,

            status:
                response.status,

            data:
                null,

            raw:
                cleanedText,

            error:
                `Server returned an invalid response (HTTP ${response.status}).`

        };
    }
}


/* ============================================================
   SUBMIT DEPOSIT
   ============================================================ */

async function submitDeposit(
    event
) {

    event.preventDefault();


    hideMessage();


    const amount =
        Number(
            amountInput?.value ||
            0
        );


    const paymentMethod =
        getSelectedPaymentMethod();


    const transactionReference =
        transactionReferenceInput
            ? transactionReferenceInput.value.trim()
            : "";


    /* --------------------------------------------------------
       Amount validation
       -------------------------------------------------------- */

    if (
        !Number.isFinite(
            amount
        ) ||
        amount <= 0
    ) {

        showMessage(
            "Please enter a valid deposit amount."
        );


        amountInput?.focus();


        return;
    }


    if (
        amount < 10000
    ) {

        showMessage(
            "Minimum deposit is UGX 10,000."
        );


        amountInput?.focus();


        return;
    }


    if (
        amount % 1000 !== 0
    ) {

        showMessage(
            "Deposit amounts must be in multiples of UGX 1,000."
        );


        amountInput?.focus();


        return;
    }


    /* --------------------------------------------------------
       Payment method
       -------------------------------------------------------- */

    if (
        ![
            "mtn",
            "airtel"
        ].includes(
            paymentMethod
        )
    ) {

        showMessage(
            "Please choose MTN Mobile Money or Airtel Money."
        );


        return;
    }


    /* --------------------------------------------------------
       Transaction reference
       -------------------------------------------------------- */

    if (
        !transactionReference
    ) {

        showMessage(
            "Please enter the transaction reference you received after payment."
        );


        transactionReferenceInput?.focus();


        return;
    }


    if (
        transactionReference.length < 3
    ) {

        showMessage(
            "Please enter the complete transaction reference."
        );


        transactionReferenceInput?.focus();


        return;
    }


    /* --------------------------------------------------------
       Merchant
       -------------------------------------------------------- */

    const merchantCodeValue =
        MERCHANT_CODES[
            paymentMethod
        ];


    /* --------------------------------------------------------
       Button loading
       -------------------------------------------------------- */

    const originalButtonHTML =
        depositButton
            ? depositButton.innerHTML
            : "";


    if (depositButton) {

        depositButton.disabled =
            true;


        depositButton.innerHTML = `
            <span
                style="
                    width:17px;
                    height:17px;
                    border:2px solid rgba(255,255,255,.35);
                    border-top-color:#ffffff;
                    border-radius:50%;
                    display:inline-block;
                    animation:ccDepositSpin .8s linear infinite;
                "
            ></span>

            Processing Deposit...
        `;
    }


    try {

        const payload = {

            amount:
                amount,

            currency:
                "UGX",

            payment_method:
                paymentMethod,

            paymentMethod:
                paymentMethod,

            merchant_code:
                merchantCodeValue,

            transaction_reference:
                transactionReference,

            transactionReference:
                transactionReference

        };


        console.log(
            "Crown Cash deposit request:",
            payload
        );


        /* ----------------------------------------------------
           POST
           ---------------------------------------------------- */

        const response =
            await fetch(
                DEPOSIT_API,
                {

                    method:
                        "POST",

                    credentials:
                        "include",

                    cache:
                        "no-store",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const result =
            await readAPIResponse(
                response
            );


        console.log(
            "Crown Cash deposit response:",
            result
        );


        /* ----------------------------------------------------
           Authentication error
           ---------------------------------------------------- */

        if (
            result.status === 401
        ) {

            throw new Error(
                result.data?.message ||
                "Your login session has expired. Please log in again."
            );
        }


        /* ----------------------------------------------------
           HTTP error
           ---------------------------------------------------- */

        if (
            !result.ok
        ) {

            throw new Error(
                result.data?.message ||
                result.data?.error ||
                result.error ||
                `Deposit request failed (HTTP ${result.status}).`
            );
        }


        /* ----------------------------------------------------
           Invalid response
           ---------------------------------------------------- */

        if (
            !result.data
        ) {

            throw new Error(
                result.error ||
                "The deposit server did not return a valid response."
            );
        }


        /* ----------------------------------------------------
           Backend failure
           ---------------------------------------------------- */

        if (
            result.data.success ===
                false
        ) {

            throw new Error(
                result.data.message ||
                result.data.error ||
                "The deposit request was rejected."
            );
        }


        /* ----------------------------------------------------
           SUCCESS
           ---------------------------------------------------- */

        showMessage(
            result.data.message ||
            "Deposit submitted successfully. It is now pending admin verification.",
            "success"
        );


        if (
            transactionReferenceInput
        ) {

            transactionReferenceInput.value =
                "";
        }


        if (
            amountInput
        ) {

            amountInput.value =
                "";
        }


        await loadDepositHistory();


        window.dispatchEvent(
            new CustomEvent(
                "crowncash:depositSubmitted",
                {
                    detail:
                        result.data
                }
            )
        );


    } catch (error) {

        console.error(
            "Crown Cash deposit error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to submit your deposit request. Please try again."
        );


    } finally {

        if (depositButton) {

            depositButton.disabled =
                false;


            depositButton.innerHTML =
                originalButtonHTML ||
                "Submit Deposit";
        }
    }
}


/* ============================================================
   LOAD DEPOSIT HISTORY
   ============================================================ */

async function loadDepositHistory() {

    if (!depositHistory) {

        return;
    }


    depositHistory.innerHTML = `
        <div class="empty-history">
            Loading your deposits...
        </div>
    `;


    try {

        const response =
            await fetch(
                DEPOSIT_API,
                {

                    method:
                        "GET",

                    credentials:
                        "include",

                    cache:
                        "no-store",

                    headers: {

                        "Accept":
                            "application/json"

                    }
                }
            );


        const result =
            await readAPIResponse(
                response
            );


        console.log(
            "Crown Cash deposit history:",
            result
        );


        if (
            result.status === 401
        ) {

            throw new Error(
                result.data?.message ||
                "Please log in to view your deposit history."
            );
        }


        if (
            !result.ok
        ) {

            throw new Error(
                result.data?.message ||
                result.data?.error ||
                result.error ||
                "Unable to load deposits."
            );
        }


        if (
            !result.data
        ) {

            throw new Error(
                "Deposit history server returned no data."
            );
        }


        const depositArray =
            Array.isArray(
                result.data.deposits
            )
                ? result.data.deposits

                : Array.isArray(
                    result.data.data
                )
                    ? result.data.data

                    : [];


        /* ----------------------------------------------------
           Balance
           ---------------------------------------------------- */

        if (
            availableBalance &&
            result.data.balance !==
                undefined
        ) {

            availableBalance.textContent =
                formatUGX(
                    result.data.balance
                );
        }


        /* ----------------------------------------------------
           Empty
           ---------------------------------------------------- */

        if (
            depositArray.length ===
                0
        ) {

            depositHistory.innerHTML = `
                <div class="empty-history">
                    No deposits found yet.
                </div>
            `;


            return;
        }


        /* ----------------------------------------------------
           Render
           ---------------------------------------------------- */

        depositHistory.innerHTML =
            depositArray
                .map(
                    renderDeposit
                )
                .join("");


    } catch (error) {

        console.error(
            "Failed to load deposit history:",
            error
        );


        depositHistory.innerHTML = `
            <div class="empty-history">
                ${escapeHTML(
                    error.message ||
                    "Unable to load deposit history."
                )}
            </div>
        `;
    }
}


/* ============================================================
   RENDER DEPOSIT
   ============================================================ */

function renderDeposit(
    deposit
) {

    const amount =
        Number(
            deposit.amount ||
            deposit.deposit_amount ||
            0
        );


    const method =
        String(
            deposit.payment_method ||
            deposit.paymentMethod ||
            ""
        )
            .toLowerCase();


    const reference =
        deposit.transaction_reference ||
        deposit.transactionReference ||
        "—";


    const status =
        String(
            deposit.status ||
            "pending"
        )
            .toLowerCase();


    const createdAt =
        deposit.created_at ||
        deposit.createdAt ||
        deposit.date ||
        "";


    let dateText =
        "—";


    if (createdAt) {

        const date =
            new Date(
                createdAt
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            dateText =
                date.toLocaleString(
                    "en-UG",
                    {
                        dateStyle:
                            "medium",

                        timeStyle:
                            "short"
                    }
                );
        }
    }


    let statusClass =
        "status-pending";


    let statusLabel =
        "Pending";


    if (
        status === "approved" ||
        status === "completed" ||
        status === "success"
    ) {

        statusClass =
            "status-approved";


        statusLabel =
            "Approved";


    } else if (
        status === "rejected" ||
        status === "declined" ||
        status === "cancelled"
    ) {

        statusClass =
            "status-rejected";


        statusLabel =
            "Rejected";
    }


    const network =
        method === "airtel"
            ? "Airtel Money"
            : "MTN Mobile Money";


    return `
        <div
            class="deposit-history-item"
            style="
                display:grid;
                grid-template-columns:auto 1fr auto;
                gap:13px;
                align-items:center;
                padding:13px 4px;
                border-bottom:1px solid rgba(255,255,255,.06);
            "
        >

            <div
                style="
                    width:38px;
                    height:38px;
                    border-radius:11px;
                    display:grid;
                    place-items:center;
                    color:#f4c542;
                    background:rgba(244,197,66,.08);
                    border:1px solid rgba(244,197,66,.12);
                "
            >

                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                >

                    <path d="M12 3v14"></path>

                    <path d="M7 12l5 5 5-5"></path>

                    <path d="M4 21h16"></path>

                </svg>

            </div>


            <div>

                <div
                    style="
                        color:#f7eff2;
                        font-size:12px;
                        font-weight:800;
                    "
                >
                    ${escapeHTML(
                        network
                    )}
                </div>


                <div
                    style="
                        margin-top:4px;
                        color:#85747c;
                        font-size:9px;
                    "
                >
                    Ref:
                    ${escapeHTML(
                        reference
                    )}
                </div>


                <div
                    style="
                        margin-top:3px;
                        color:#706169;
                        font-size:9px;
                    "
                >
                    ${escapeHTML(
                        dateText
                    )}
                </div>

            </div>


            <div
                style="
                    text-align:right;
                "
            >

                <div
                    style="
                        color:#f4c542;
                        font-size:13px;
                        font-weight:850;
                    "
                >
                    ${escapeHTML(
                        formatUGX(
                            amount
                        )
                    )}
                </div>


                <div
                    class="${statusClass}"
                    style="
                        display:inline-block;
                        margin-top:5px;
                        padding:4px 8px;
                        border-radius:999px;
                        font-size:8px;
                        font-weight:850;
                        text-transform:uppercase;
                    "
                >
                    ${escapeHTML(
                        statusLabel
                    )}
                </div>

            </div>

        </div>
    `;
}


/* ============================================================
   FORM EVENT
   ============================================================ */

if (depositForm) {

    depositForm.addEventListener(
        "submit",
        submitDeposit
    );
}


/* ============================================================
   PAYMENT METHOD EVENTS
   ============================================================ */

if (mtnRadio) {

    mtnRadio.addEventListener(
        "change",
        function () {

            if (
                this.checked
            ) {

                updatePaymentDetails(
                    "mtn"
                );

                hideMessage();
            }
        }
    );
}


if (airtelRadio) {

    airtelRadio.addEventListener(
        "change",
        function () {

            if (
                this.checked
            ) {

                updatePaymentDetails(
                    "airtel"
                );

                hideMessage();
            }
        }
    );
}


/* ============================================================
   COPY BUTTON
   ============================================================ */

if (copyMerchantCode) {

    copyMerchantCode.addEventListener(
        "click",
        copyMerchantCodeToClipboard
    );
}


/* ============================================================
   INITIAL PAYMENT DETAILS
   ============================================================ */

const initialMethod =
    getSelectedPaymentMethod() ||
    "mtn";


updatePaymentDetails(
    initialMethod
);


/* ============================================================
   LOADING ANIMATION
   ============================================================ */

if (
    !document.getElementById(
        "ccDepositAnimation"
    )
) {

    const style =
        document.createElement(
            "style"
        );


    style.id =
        "ccDepositAnimation";


    style.textContent = `

        @keyframes ccDepositSpin {

            to {
                transform:
                    rotate(360deg);
            }

        }


        .status-pending {

            color:#ffe5a3;

            background:
                rgba(245,185,66,.10);

            border:
                1px solid
                rgba(245,185,66,.16);
        }


        .status-approved {

            color:#b8f3d1;

            background:
                rgba(53,208,127,.10);

            border:
                1px solid
                rgba(53,208,127,.16);
        }


        .status-rejected {

            color:#ffd1d8;

            background:
                rgba(255,91,112,.10);

            border:
                1px solid
                rgba(255,91,112,.16);
        }


        .deposit-history-item:last-child {

            border-bottom:
                none !important;
        }

    `;


    document.head.appendChild(
        style
    );
}


/* ============================================================
   INITIAL HISTORY LOAD
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadDepositHistory();

    }
);


/* ============================================================
   AFTER DEPOSIT EVENT
   ============================================================ */

window.addEventListener(
    "crowncash:depositSubmitted",
    () => {

        setTimeout(
            loadDepositHistory,
            700
        );

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.CrownCashDeposit = {

    submit:
        submitDeposit,

    reloadHistory:
        loadDepositHistory,

    updatePayment:
        updatePaymentDetails

};


/* ============================================================
   CONSOLE
   ============================================================ */

console.log(
    "Crown Cash Deposit System initialized."
);

console.log(
    "Deposit API:",
    DEPOSIT_API
);

console.log(
    "MTN Merchant Code:",
    MERCHANT_CODES.mtn
);

console.log(
    "Airtel Merchant Code:",
    MERCHANT_CODES.airtel
);