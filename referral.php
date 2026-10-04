<?php
/**
 * Crown Cash
 * referral.php
 *
 * Referral Center API
 *
 * Referral flow:
 *
 * Referral Link
 *      ↓
 * Crown Cash Homepage
 *      ↓
 * Registration
 *      ↓
 * Dashboard
 *
 * Example:
 *
 * https://crown-cash.vercel.app/?ref=CC87A040AD
 *
 * Commission structure:
 * L1 = 15%
 * L2 = 5%
 * L3 = 2%
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;


/* ============================================================
   CORS
   ============================================================ */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
];

$origin =
    $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin !== '' &&
    in_array(
        $origin,
        $allowedOrigins,
        true
    )
) {
    header(
        "Access-Control-Allow-Origin: {$origin}"
    );

    header(
        'Access-Control-Allow-Credentials: true'
    );

    header(
        'Vary: Origin'
    );
}

header(
    'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: GET, OPTIONS'
);

header(
    'Content-Type: application/json; charset=utf-8'
);


/* ============================================================
   OPTIONS
   ============================================================ */

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET')
    === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}


/* ============================================================
   ONLY GET
   ============================================================ */

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET')
    !== 'GET'
) {
    http_response_code(405);

    echo json_encode(
        [
            'success' => false,
            'message' =>
                'Method not allowed.'
        ],
        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* ============================================================
   SESSION
   ============================================================ */

try {

    if (
        function_exists(
            'startSecureSession'
        )
    ) {

        startSecureSession();

    } else {

        if (
            session_status()
            !== PHP_SESSION_ACTIVE
        ) {

            /*
             * IMPORTANT:
             * Use the same session name as login.php,
             * dashboard.php and the other protected APIs.
             */
            session_name(
                'CROWN_CASH_SESSION'
            );

            session_set_cookie_params(
                [
                    'httponly' => true,
                    'secure' => true,
                    'samesite' => 'None',
                    'path' => '/'
                ]
            );

            session_start();
        }
    }

} catch (Throwable $e) {

    if (
        session_status()
        !== PHP_SESSION_ACTIVE
    ) {

        @session_name(
            'CROWN_CASH_SESSION'
        );

        @session_start();
    }
}


/* ============================================================
   RESPONSE HELPER
   ============================================================ */

function referralResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): void {

    http_response_code(
        $status
    );

    /*
     * Return the main referral fields both:
     *
     * 1. inside data
     * 2. at the top level
     *
     * This makes the endpoint compatible with the
     * existing Crown Cash frontend.
     */

    $response = [
        'success' => $success,
        'message' => $message,
        'data' => $data
    ];

    if (
        array_key_exists(
            'referral_code',
            $data
        )
    ) {

        $response['referral_code'] =
            $data['referral_code'];
    }

    if (
        array_key_exists(
            'referral_link',
            $data
        )
    ) {

        $response['referral_link'] =
            $data['referral_link'];
    }

    if (
        array_key_exists(
            'counts',
            $data
        )
    ) {

        $response['counts'] =
            $data['counts'];
    }

    if (
        array_key_exists(
            'earnings',
            $data
        )
    ) {

        $response['earnings'] =
            $data['earnings'];
    }

    if (
        array_key_exists(
            'members',
            $data
        )
    ) {

        $response['members'] =
            $data['members'];
    }

    if (
        array_key_exists(
            'commission_structure',
            $data
        )
    ) {

        $response['commission_structure'] =
            $data['commission_structure'];
    }

    echo json_encode(
        $response,
        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_PARTIAL_OUTPUT_ON_ERROR
    );

    exit;
}


/* ============================================================
   STRING HELPER
   ============================================================ */

function refString(
    $value,
    string $default = ''
): string {

    if ($value === null) {
        return $default;
    }

    if (
        $value instanceof ObjectId
    ) {

        return (string) $value;
    }

    if (
        $value instanceof UTCDateTime
    ) {

        return
            $value
                ->toDateTime()
                ->format('c');
    }

    if (
        is_scalar($value)
    ) {

        return trim(
            (string) $value
        );
    }

    return $default;
}


/* ============================================================
   MONEY HELPER
   ============================================================ */

function refMoney(
    $value,
    float $default = 0.0
): float {

    if (
        $value === null ||
        $value === ''
    ) {

        return $default;
    }

    if (
        is_numeric($value)
    ) {

        return round(
            (float) $value,
            2
        );
    }

    return $default;
}


/* ============================================================
   OBJECT ID HELPER
   ============================================================ */

function refObjectId(
    $value
): ?ObjectId {

    if (
        $value instanceof ObjectId
    ) {

        return $value;
    }

    $value =
        refString($value);

    if (
        $value !== '' &&
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $value
        )
    ) {

        try {

            return new ObjectId(
                $value
            );

        } catch (Throwable $e) {

            return null;
        }
    }

    return null;
}


/* ============================================================
   SESSION USER ID
   ============================================================ */

function referralSessionUserId(): string
{
    $values = [

        $_SESSION['user_id']
            ?? null,

        $_SESSION['userId']
            ?? null,

        $_SESSION['uid']
            ?? null,

        $_SESSION['user']['id']
            ?? null,

        $_SESSION['user']['_id']
            ?? null
    ];

    foreach (
        $values as $value
    ) {

        $id =
            refString($value);

        if (
            $id !== ''
        ) {

            return $id;
        }
    }

    return '';
}


/* ============================================================
   SESSION EMAIL
   ============================================================ */

function referralSessionEmail(): string
{
    $values = [

        $_SESSION['email']
            ?? null,

        $_SESSION['user_email']
            ?? null,

        $_SESSION['user']['email']
            ?? null
    ];

    foreach (
        $values as $value
    ) {

        $email =
            refString($value);

        if (
            $email !== ''
        ) {

            return strtolower(
                $email
            );
        }
    }

    return '';
}


/* ============================================================
   FIND USER
   ============================================================ */

function findReferralUser(
    $users,
    string $userId = '',
    string $email = ''
) {

    $conditions = [];

    if (
        $userId !== ''
    ) {

        $oid =
            refObjectId(
                $userId
            );

        if (
            $oid !== null
        ) {

            $conditions[] = [
                '_id' => $oid
            ];
        }

        $conditions[] = [
            'id' => $userId
        ];

        $conditions[] = [
            'user_id' => $userId
        ];
    }

    if (
        $email !== ''
    ) {

        $conditions[] = [
            'email' =>
                strtolower($email)
        ];

        $conditions[] = [
            'email' =>
                $email
        ];
    }

    if (
        !$conditions
    ) {

        return null;
    }

    try {

        return $users->findOne(
            [
                '$or' =>
                    $conditions
            ]
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* ============================================================
   GET USER ID
   ============================================================ */

function getReferralUserId(
    $user
): string {

    if (!$user) {
        return '';
    }

    foreach (
        [
            $user['_id'] ?? null,
            $user['id'] ?? null,
            $user['user_id'] ?? null
        ] as $value
    ) {

        $id =
            refString($value);

        if (
            $id !== ''
        ) {

            return $id;
        }
    }

    return '';
}


/* ============================================================
   GET REFERRAL CODE
   ============================================================ */

function getReferralCode(
    $user
): string {

    if (!$user) {
        return '';
    }

    $fields = [

        'referral_code',
        'referralCode',
        'ref_code',
        'refCode',
        'invite_code',
        'inviteCode'
    ];

    foreach (
        $fields as $field
    ) {

        if (
            !isset(
                $user[$field]
            )
        ) {
            continue;
        }

        $code =
            refString(
                $user[$field]
            );

        if (
            $code !== ''
        ) {

            return strtoupper(
                $code
            );
        }
    }

    return '';
}


/* ============================================================
   GENERATE PERMANENT REFERRAL CODE
   ============================================================ */

function generateReferralCode(
    string $userId
): string {

    /*
     * Generate a stable Crown Cash code.
     *
     * Example:
     *
     * CC87A040AD
     */

    $hash =
        strtoupper(
            substr(
                hash(
                    'sha256',
                    'CROWN-CASH-REFERRAL-'
                    . $userId
                ),
                0,
                10
            )
        );

    return 'CC' . $hash;
}


/* ============================================================
   SAVE REFERRAL CODE
   ============================================================ */

function ensureReferralCode(
    $users,
    $user,
    string $userId
): string {

    $existing =
        getReferralCode(
            $user
        );

    if (
        $existing !== ''
    ) {

        return $existing;
    }

    if (
        $userId === ''
    ) {

        return '';
    }

    $newCode =
        generateReferralCode(
            $userId
        );

    /*
     * Build a safe user selector.
     */

    $selector = [];

    $oid =
        refObjectId(
            $userId
        );

    if (
        $oid !== null
    ) {

        $selector = [
            '_id' => $oid
        ];

    } else {

        $selector = [
            '$or' => [
                [
                    'id' =>
                        $userId
                ],
                [
                    'user_id' =>
                        $userId
                ]
            ]
        ];
    }

    try {

        /*
         * Only create the code when one does not already exist.
         *
         * This prevents overwriting an existing referral code.
         */

        $result =
            $users->updateOne(
                $selector,
                [
                    '$set' => [
                        'referral_code' =>
                            $newCode,

                        'referralCode' =>
                            $newCode
                    ]
                ]
            );

        /*
         * Whether modified or matched, return the code.
         * The selector guarantees this is the user's code.
         */

        return $newCode;

    } catch (Throwable $e) {

        /*
         * We still return the deterministic code.
         * The next request will attempt to persist it again.
         */

        return $newCode;
    }
}


/* ============================================================
   REFERRAL PARENT FIELDS
   ============================================================ */

function referralParentValue(
    $user
): string {

    if (!$user) {
        return '';
    }

    $fields = [

        'referrer_id',
        'referrerId',
        'referrer',

        'referred_by_id',
        'referredById',
        'referred_by',

        'parent_id',
        'parentId',

        'sponsor_id',
        'sponsorId',
        'sponsor',

        'upline_id',
        'uplineId'
    ];

    foreach (
        $fields as $field
    ) {

        if (
            !array_key_exists(
                $field,
                $user
            )
        ) {
            continue;
        }

        $value =
            $user[$field];

        if (
            $value instanceof ObjectId
        ) {

            return (string) $value;
        }

        $value =
            refString($value);

        if (
            $value !== ''
        ) {

            return $value;
        }
    }

    return '';
}


/* ============================================================
   FIND DIRECT REFERRALS
   ============================================================ */

function findDirectReferrals(
    $users,
    string $parentId,
    string $parentEmail = '',
    string $parentCode = ''
): array {

    if (
        $parentId === ''
    ) {

        return [];
    }

    $conditions = [];

    $parentOid =
        refObjectId(
            $parentId
        );


    /*
     * ObjectId fields.
     */

    if (
        $parentOid !== null
    ) {

        foreach (
            [
                'referrer_id',
                'referrerId',
                'referred_by_id',
                'referredById',
                'parent_id',
                'parentId',
                'sponsor_id',
                'sponsorId',
                'upline_id',
                'uplineId'
            ] as $field
        ) {

            $conditions[] = [
                $field =>
                    $parentOid
            ];
        }
    }


    /*
     * String ID fields.
     */

    foreach (
        [
            'referrer_id',
            'referrerId',
            'referrer',
            'referred_by_id',
            'referredById',
            'referred_by',
            'parent_id',
            'parentId',
            'sponsor_id',
            'sponsorId',
            'sponsor',
            'upline_id',
            'uplineId'
        ] as $field
    ) {

        $conditions[] = [
            $field =>
                $parentId
        ];
    }


    /*
     * Email-based referral fields.
     */

    if (
        $parentEmail !== ''
    ) {

        foreach (
            [
                'referrer',
                'referrer_email',
                'referrerEmail',
                'referred_by',
                'sponsor',
                'sponsor_email',
                'sponsorEmail'
            ] as $field
        ) {

            $conditions[] = [
                $field =>
                    $parentEmail
            ];
        }
    }


    /*
     * Referral-code-based fields.
     */

    if (
        $parentCode !== ''
    ) {

        foreach (
            [
                'referrer_code',
                'referrerCode',
                'referral_code_used',
                'referralCodeUsed',
                'sponsor_code',
                'sponsorCode',
                'referred_by_code',
                'referredByCode'
            ] as $field
        ) {

            $conditions[] = [
                $field =>
                    $parentCode
            ];
        }
    }


    if (
        !$conditions
    ) {

        return [];
    }


    try {

        $cursor =
            $users->find(
                [
                    '$or' =>
                        $conditions
                ],
                [
                    'limit' => 5000,

                    'sort' => [
                        'created_at' => 1
                    ]
                ]
            );


        $result = [];

        $seen = [];


        foreach (
            $cursor as $member
        ) {

            $memberId =
                getReferralUserId(
                    $member
                );

            if (
                $memberId === ''
            ) {

                continue;
            }


            $key =
                strtolower(
                    $memberId
                );


            if (
                isset(
                    $seen[$key]
                )
            ) {

                continue;
            }


            $seen[$key] =
                true;


            $result[] =
                $member;
        }


        return $result;

    } catch (Throwable $e) {

        return [];
    }
}


/* ============================================================
   BUILD L1/L2/L3
   ============================================================ */

function buildReferralLevels(
    $users,
    $currentUser
): array {

    $levels = [

        1 => [],
        2 => [],
        3 => []
    ];


    if (
        !$currentUser
    ) {

        return $levels;
    }


    $currentId =
        getReferralUserId(
            $currentUser
        );


    if (
        $currentId === ''
    ) {

        return $levels;
    }


    $currentEmail =
        strtolower(
            refString(
                $currentUser['email']
                ?? ''
            )
        );


    $currentCode =
        getReferralCode(
            $currentUser
        );


    /*
     * ========================================================
     * LEVEL 1
     * ========================================================
     */

    $level1 =
        findDirectReferrals(
            $users,
            $currentId,
            $currentEmail,
            $currentCode
        );


    $levels[1] =
        $level1;


    /*
     * ========================================================
     * LEVEL 2
     * ========================================================
     */

    $level2 = [];

    $seenLevel2 = [];


    foreach (
        $level1 as $member
    ) {

        $memberId =
            getReferralUserId(
                $member
            );

        if (
            $memberId === ''
        ) {

            continue;
        }


        $memberEmail =
            strtolower(
                refString(
                    $member['email']
                    ?? ''
                )
            );


        $memberCode =
            getReferralCode(
                $member
            );


        $children =
            findDirectReferrals(
                $users,
                $memberId,
                $memberEmail,
                $memberCode
            );


        foreach (
            $children as $child
        ) {

            $childId =
                getReferralUserId(
                    $child
                );


            if (
                $childId === ''
            ) {

                continue;
            }


            if (
                strtolower(
                    $childId
                )
                ===
                strtolower(
                    $currentId
                )
            ) {

                continue;
            }


            $key =
                strtolower(
                    $childId
                );


            if (
                isset(
                    $seenLevel2[$key]
                )
            ) {

                continue;
            }


            $seenLevel2[$key] =
                true;


            $level2[] =
                $child;
        }
    }


    $levels[2] =
        $level2;


    /*
     * ========================================================
     * LEVEL 3
     * ========================================================
     */

    $level3 = [];

    $seenLevel3 = [];


    foreach (
        $level2 as $member
    ) {

        $memberId =
            getReferralUserId(
                $member
            );


        if (
            $memberId === ''
        ) {

            continue;
        }


        $memberEmail =
            strtolower(
                refString(
                    $member['email']
                    ?? ''
                )
            );


        $memberCode =
            getReferralCode(
                $member
            );


        $children =
            findDirectReferrals(
                $users,
                $memberId,
                $memberEmail,
                $memberCode
            );


        foreach (
            $children as $child
        ) {

            $childId =
                getReferralUserId(
                    $child
                );


            if (
                $childId === ''
            ) {

                continue;
            }


            if (
                strtolower(
                    $childId
                )
                ===
                strtolower(
                    $currentId
                )
            ) {

                continue;
            }


            $key =
                strtolower(
                    $childId
                );


            if (
                isset(
                    $seenLevel3[$key]
                )
            ) {

                continue;
            }


            $seenLevel3[$key] =
                true;


            $level3[] =
                $child;
        }
    }


    $levels[3] =
        $level3;


    return $levels;
}


/* ============================================================
   FORMAT TEAM MEMBER
   ============================================================ */

function formatReferralMember(
    $member
): array {

    $id =
        getReferralUserId(
            $member
        );


    $firstName =
        refString(
            $member['first_name']
            ?? $member['firstName']
            ?? ''
        );


    $lastName =
        refString(
            $member['last_name']
            ?? $member['lastName']
            ?? ''
        );


    $fullName =
        refString(
            $member['full_name']
            ?? $member['fullName']
            ?? $member['name']
            ?? ''
        );


    if (
        $fullName === ''
    ) {

        $fullName =
            trim(
                $firstName
                . ' '
                . $lastName
            );
    }


    if (
        $fullName === ''
    ) {

        $fullName =
            'Crown Cash Member';
    }


    $email =
        refString(
            $member['email']
            ?? ''
        );


    $phone =
        refString(
            $member['phone']
            ?? $member['phone_number']
            ?? $member['phoneNumber']
            ?? ''
        );


    return [

        'id' =>
            $id,

        '_id' =>
            $id,

        'name' =>
            $fullName,

        'full_name' =>
            $fullName,

        'firstName' =>
            $firstName,

        'lastName' =>
            $lastName,

        'email' =>
            $email,

        'phone' =>
            $phone,

        'status' =>
            refString(
                $member['status']
                ?? 'active'
            )
    ];
}


/* ============================================================
   USER COMMISSION TOTALS
   ============================================================ */

function getUserCommissionTotals(
    $user
): array {

    $l1 = 0.0;
    $l2 = 0.0;
    $l3 = 0.0;


    if (
        $user
    ) {

        $l1 =
            refMoney(
                $user['l1_earnings']
                ?? $user['level1_earnings']
                ?? $user['level_1_earnings']
                ?? 0
            );


        $l2 =
            refMoney(
                $user['l2_earnings']
                ?? $user['level2_earnings']
                ?? $user['level_2_earnings']
                ?? 0
            );


        $l3 =
            refMoney(
                $user['l3_earnings']
                ?? $user['level3_earnings']
                ?? $user['level_3_earnings']
                ?? 0
            );
    }


    return [

        'l1' =>
            round(
                $l1,
                2
            ),

        'l2' =>
            round(
                $l2,
                2
            ),

        'l3' =>
            round(
                $l3,
                2
            ),

        'total' =>
            round(
                $l1
                + $l2
                + $l3,
                2
            )
    ];
}


/* ============================================================
   LEDGER FALLBACK
   ============================================================ */

function getLedgerReferralTotals(
    $earnings,
    string $userId
): array {

    $empty = [

        'l1' => 0.0,
        'l2' => 0.0,
        'l3' => 0.0,
        'total' => 0.0
    ];


    if (
        !$earnings ||
        $userId === ''
    ) {

        return $empty;
    }


    $conditions = [];

    $oid =
        refObjectId(
            $userId
        );


    if (
        $oid !== null
    ) {

        $conditions[] = [
            'user_id' =>
                $oid
        ];
    }


    $conditions[] = [
        'user_id' =>
            $userId
    ];


    $conditions[] = [
        'userId' =>
            $userId
    ];


    try {

        $cursor =
            $earnings->find(
                [
                    '$and' => [

                        [
                            '$or' =>
                                $conditions
                        ],

                        [
                            '$or' => [

                                [
                                    'type' =>
                                        'referral_commission'
                                ],

                                [
                                    'earning_type' =>
                                        'referral_L1'
                                ],

                                [
                                    'earning_type' =>
                                        'referral_L2'
                                ],

                                [
                                    'earning_type' =>
                                        'referral_L3'
                                ]
                            ]
                        ],

                        [
                            'status' => [
                                '$in' => [
                                    'credited',
                                    'completed',
                                    'success'
                                ]
                            ]
                        ]
                    ]
                ]
            );


        $totals = [

            'l1' => 0.0,
            'l2' => 0.0,
            'l3' => 0.0
        ];


        foreach (
            $cursor as $entry
        ) {

            $level =
                (int)
                refMoney(
                    $entry['level']
                    ?? 0
                );


            if (
                $level < 1 ||
                $level > 3
            ) {

                $type =
                    strtolower(
                        refString(
                            $entry['earning_type']
                            ?? $entry['category']
                            ?? ''
                        )
                    );


                if (
                    str_contains(
                        $type,
                        'l1'
                    )
                ) {

                    $level = 1;

                } elseif (
                    str_contains(
                        $type,
                        'l2'
                    )
                ) {

                    $level = 2;

                } elseif (
                    str_contains(
                        $type,
                        'l3'
                    )
                ) {

                    $level = 3;
                }
            }


            $amount =
                refMoney(
                    $entry['amount']
                    ?? $entry['earning']
                    ?? 0
                );


            if (
                $level === 1
            ) {

                $totals['l1'] +=
                    $amount;

            } elseif (
                $level === 2
            ) {

                $totals['l2'] +=
                    $amount;

            } elseif (
                $level === 3
            ) {

                $totals['l3'] +=
                    $amount;
            }
        }


        $totals['l1'] =
            round(
                $totals['l1'],
                2
            );


        $totals['l2'] =
            round(
                $totals['l2'],
                2
            );


        $totals['l3'] =
            round(
                $totals['l3'],
                2
            );


        $totals['total'] =
            round(
                $totals['l1']
                + $totals['l2']
                + $totals['l3'],
                2
            );


        return $totals;

    } catch (Throwable $e) {

        return $empty;
    }
}


/* ============================================================
   BUILD HOMEPAGE REFERRAL LINK
   ============================================================ */

function buildReferralLink(
    string $code
): string {

    if (
        $code === ''
    ) {

        return '';
    }


    return
        'https://crown-cash.vercel.app/'
        . '?ref='
        . rawurlencode(
            strtoupper(
                $code
            )
        );
}


/* ============================================================
   MAIN
   ============================================================ */

try {

    /*
     * Get current logged-in user.
     */

    $userId =
        referralSessionUserId();

    $email =
        referralSessionEmail();


    if (
        $userId === '' &&
        $email === ''
    ) {

        referralResponse(
            false,
            'Please log in to view your referral information.',
            [],
            401
        );
    }


    /*
     * Find the actual database user.
     */

    $user =
        findReferralUser(
            $users,
            $userId,
            $email
        );


    if (
        !$user
    ) {

        referralResponse(
            false,
            'Your Crown Cash account could not be found.',
            [],
            401
        );
    }


    /*
     * Get authoritative user ID.
     */

    $actualUserId =
        getReferralUserId(
            $user
        );


    if (
        $actualUserId === ''
    ) {

        referralResponse(
            false,
            'Your user account ID could not be determined.',
            [],
            400
        );
    }


    /*
     * ========================================================
     * REFERRAL CODE
     * ========================================================
     *
     * IMPORTANT:
     *
     * If the user already has a code, preserve it.
     *
     * If not, create and permanently save one.
     */

    $referralCode =
        ensureReferralCode(
            $users,
            $user,
            $actualUserId
        );


    if (
        $referralCode === ''
    ) {

        referralResponse(
            false,
            'Unable to create your referral code.',
            [],
            500
        );
    }


    /*
     * ========================================================
     * REFERRAL LINK
     * ========================================================
     *
     * ALWAYS START FROM HOMEPAGE.
     */

    $referralLink =
        buildReferralLink(
            $referralCode
        );


    /*
     * ========================================================
     * BUILD L1/L2/L3
     * ========================================================
     */

    $levels =
        buildReferralLevels(
            $users,
            $user
        );


    /*
     * L1
     */

    $level1Members = [];

    foreach (
        $levels[1]
        as $member
    ) {

        $level1Members[] =
            formatReferralMember(
                $member
            );
    }


    /*
     * L2
     */

    $level2Members = [];

    foreach (
        $levels[2]
        as $member
    ) {

        $level2Members[] =
            formatReferralMember(
                $member
            );
    }


    /*
     * L3
     */

    $level3Members = [];

    foreach (
        $levels[3]
        as $member
    ) {

        $level3Members[] =
            formatReferralMember(
                $member
            );
    }


    /*
     * ========================================================
     * COUNTS
     * ========================================================
     */

    $l1Count =
        count(
            $level1Members
        );

    $l2Count =
        count(
            $level2Members
        );

    $l3Count =
        count(
            $level3Members
        );

    $teamCount =
        $l1Count
        + $l2Count
        + $l3Count;


    /*
     * ========================================================
     * COMMISSION TOTALS
     * ========================================================
     */

    $userTotals =
        getUserCommissionTotals(
            $user
        );


    /*
     * Ledger fallback.
     *
     * Only use this when the user's stored totals are zero.
     */

    if (
        isset($earnings)
    ) {

        $ledgerTotals =
            getLedgerReferralTotals(
                $earnings,
                $actualUserId
            );

        if (
            $userTotals['total'] <= 0
            &&
            $ledgerTotals['total'] > 0
        ) {

            $userTotals =
                $ledgerTotals;
        }
    }


    /*
     * ========================================================
     * USER BALANCE
     * ========================================================
     */

    $balance = 0.0;


    if (
        isset($user['balance'])
        &&
        is_numeric(
            $user['balance']
        )
    ) {

        $balance =
            refMoney(
                $user['balance']
            );

    } elseif (
        isset($user['wallet_balance'])
        &&
        is_numeric(
            $user['wallet_balance']
        )
    ) {

        $balance =
            refMoney(
                $user['wallet_balance']
            );

    } elseif (
        isset($user['walletBalance'])
        &&
        is_numeric(
            $user['walletBalance']
        )
    ) {

        $balance =
            refMoney(
                $user['walletBalance']
            );

    } elseif (
        isset($user['wallet'])
        &&
        is_array(
            $user['wallet']
        ) &&
        isset(
            $user['wallet']['balance']
        )
    ) {

        $balance =
            refMoney(
                $user['wallet']['balance']
            );
    }


    /*
     * ========================================================
     * USER NAME
     * ========================================================
     */

    $firstName =
        refString(
            $user['first_name']
            ?? $user['firstName']
            ?? ''
        );


    $lastName =
        refString(
            $user['last_name']
            ?? $user['lastName']
            ?? ''
        );


    $fullName =
        refString(
            $user['full_name']
            ?? $user['fullName']
            ?? $user['name']
            ?? ''
        );


    if (
        $fullName === ''
    ) {

        $fullName =
            trim(
                $firstName
                . ' '
                . $lastName
            );
    }


    /*
     * ========================================================
     * TEAM MEMBERS
     * ========================================================
     */

    $allMembers =
        array_merge(
            $level1Members,
            $level2Members,
            $level3Members
        );


    /*
     * ========================================================
     * FINAL RESPONSE DATA
     * ========================================================
     */

    $responseData = [

        /*
         * USER
         */

        'user' => [

            'id' =>
                $actualUserId,

            'name' =>
                $fullName,

            'email' =>
                refString(
                    $user['email']
                    ?? ''
                ),

            'balance' =>
                $balance
        ],


        /*
         * MAIN REFERRAL INFORMATION
         */

        'referral_code' =>
            $referralCode,

        'referral_link' =>
            $referralLink,


        /*
         * REFERRAL OBJECT
         */

        'referral' => [

            'code' =>
                $referralCode,

            'referral_code' =>
                $referralCode,

            'link' =>
                $referralLink,

            'referral_link' =>
                $referralLink,

            'rates' => [

                'l1' => 15,
                'l2' => 5,
                'l3' => 2
            ],

            'commission_rates' => [

                'level1' => 15,
                'level2' => 5,
                'level3' => 2
            ]
        ],


        /*
         * COUNTS
         */

        'counts' => [

            'l1' =>
                $l1Count,

            'l2' =>
                $l2Count,

            'l3' =>
                $l3Count,

            'total' =>
                $teamCount
        ],


        /*
         * EARNINGS
         */

        'earnings' => [

            'l1' =>
                $userTotals['l1'],

            'l2' =>
                $userTotals['l2'],

            'l3' =>
                $userTotals['l3'],

            'total' =>
                $userTotals['total']
        ],


        /*
         * MEMBERS
         *
         * The frontend can directly use this array.
         */

        'members' =>
            $allMembers,


        /*
         * SEPARATE LEVEL LISTS
         */

        'level1_members' =>
            $level1Members,

        'level2_members' =>
            $level2Members,

        'level3_members' =>
            $level3Members,


        /*
         * COMMISSION STRUCTURE
         */

        'commission_structure' => [

            'l1' => 15,
            'l2' => 5,
            'l3' => 2
        ],


        /*
         * COMPATIBILITY FIELDS
         */

        'l1_count' =>
            $l1Count,

        'l2_count' =>
            $l2Count,

        'l3_count' =>
            $l3Count,

        'team_count' =>
            $teamCount,

        'l1_earnings' =>
            $userTotals['l1'],

        'l2_earnings' =>
            $userTotals['l2'],

        'l3_earnings' =>
            $userTotals['l3'],

        'total_earnings' =>
            $userTotals['total'],

        'referral_earnings' =>
            $userTotals['total'],

        'total_referral_earnings' =>
            $userTotals['total']
    ];


    /*
     * ========================================================
     * RETURN
     * ========================================================
     */

    referralResponse(
        true,
        'Referral information loaded successfully.',
        $responseData,
        200
    );


} catch (
    Throwable $e
) {

    /*
     * Do not expose the internal error to normal users.
     */

    error_log(
        'Crown Cash referral.php error: '
        . $e->getMessage()
    );


    referralResponse(
        false,
        'Unable to load referral information.',
        [],
        500
    );
}