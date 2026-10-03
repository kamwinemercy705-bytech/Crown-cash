<?php
/**
 * Crown Cash
 * referral.php
 *
 * Returns referral information for the logged-in user.
 *
 * Referral commission structure:
 * L1 = 15%
 * L2 = 5%
 * L3 = 2%
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/* =========================================================
   CORS
   ========================================================= */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* =========================================================
   SESSION
   ========================================================= */

try {
    if (function_exists('startSecureSession')) {
        startSecureSession();
    } else {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params([
                'httponly' => true,
                'secure' => true,
                'samesite' => 'None'
            ]);

            session_start();
        }
    }
} catch (Throwable $e) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
}

/* =========================================================
   RESPONSE
   ========================================================= */

function referralResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): void {
    http_response_code($status);

    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'data' => $data
        ],
        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_PARTIAL_OUTPUT_ON_ERROR
    );

    exit;
}

/* =========================================================
   HELPERS
   ========================================================= */

function refString($value, string $default = ''): string
{
    if ($value === null) {
        return $default;
    }

    if ($value instanceof ObjectId) {
        return (string) $value;
    }

    if ($value instanceof UTCDateTime) {
        return $value->toDateTime()->format('c');
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return $default;
}

function refMoney($value, float $default = 0.0): float
{
    if ($value === null || $value === '') {
        return $default;
    }

    if (is_numeric($value)) {
        return round((float) $value, 2);
    }

    return $default;
}

function refObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value = refString($value);

    if (
        $value !== ''
        && preg_match('/^[a-f0-9]{24}$/i', $value)
    ) {
        try {
            return new ObjectId($value);
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}

/* =========================================================
   CURRENT SESSION USER
   ========================================================= */

function referralSessionUserId(): string
{
    $values = [
        $_SESSION['user_id'] ?? null,
        $_SESSION['userId'] ?? null,
        $_SESSION['uid'] ?? null,
        $_SESSION['user']['id'] ?? null,
        $_SESSION['user']['_id'] ?? null
    ];

    foreach ($values as $value) {
        $id = refString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function referralSessionEmail(): string
{
    $values = [
        $_SESSION['email'] ?? null,
        $_SESSION['user_email'] ?? null,
        $_SESSION['user']['email'] ?? null
    ];

    foreach ($values as $value) {
        $email = refString($value);

        if ($email !== '') {
            return strtolower($email);
        }
    }

    return '';
}

/* =========================================================
   USER LOOKUP
   ========================================================= */

function findReferralUser(
    $users,
    string $userId = '',
    string $email = ''
) {
    $conditions = [];

    if ($userId !== '') {
        $oid = refObjectId($userId);

        if ($oid !== null) {
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

    if ($email !== '') {
        $conditions[] = [
            'email' => strtolower($email)
        ];

        $conditions[] = [
            'email' => $email
        ];
    }

    if (!$conditions) {
        return null;
    }

    try {
        return $users->findOne([
            '$or' => $conditions
        ]);
    } catch (Throwable $e) {
        return null;
    }
}

function getReferralUserId($user): string
{
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
        $id = refString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

/* =========================================================
   REFERRAL CODE
   ========================================================= */

function getReferralCode($user): string
{
    if (!$user) {
        return '';
    }

    $fields = [
        'referral_code',
        'referralCode',
        'ref_code',
        'refCode',
        'invite_code',
        'inviteCode',
        'code'
    ];

    foreach ($fields as $field) {
        if (!isset($user[$field])) {
            continue;
        }

        $code = refString($user[$field]);

        if ($code !== '') {
            return $code;
        }
    }

    return '';
}

/* =========================================================
   REFERRER FIELD DETECTION
   ========================================================= */

function referralParentValue($user): string
{
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

    foreach ($fields as $field) {
        if (!array_key_exists($field, $user)) {
            continue;
        }

        $value = $user[$field];

        if ($value instanceof ObjectId) {
            return (string) $value;
        }

        $value = refString($value);

        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

/* =========================================================
   FIND USERS REFERRED BY A USER
   ========================================================= */

function findDirectReferrals(
    $users,
    string $parentId,
    string $parentEmail = '',
    string $parentCode = ''
): array {
    if ($parentId === '') {
        return [];
    }

    $conditions = [];

    $parentOid = refObjectId($parentId);

    /*
     * ObjectId representations.
     */
    if ($parentOid !== null) {
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
                $field => $parentOid
            ];
        }
    }

    /*
     * String ID representations.
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
            $field => $parentId
        ];
    }

    /*
     * Email can sometimes be stored as the referral parent.
     */
    if ($parentEmail !== '') {
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
                $field => $parentEmail
            ];
        }
    }

    /*
     * Referral code can sometimes be stored directly.
     */
    if ($parentCode !== '') {
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
                $field => $parentCode
            ];
        }
    }

    if (!$conditions) {
        return [];
    }

    try {
        $cursor = $users->find(
            [
                '$or' => $conditions
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

        foreach ($cursor as $member) {
            $memberId = getReferralUserId($member);

            if ($memberId === '') {
                continue;
            }

            /*
             * Prevent duplicate records when the same user matches
             * several possible referral fields.
             */
            $key = strtolower($memberId);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;

            $result[] = $member;
        }

        return $result;
    } catch (Throwable $e) {
        return [];
    }
}

/* =========================================================
   FIND LEVELS 1, 2 AND 3
   ========================================================= */

function buildReferralLevels(
    $users,
    $currentUser
): array {
    $levels = [
        1 => [],
        2 => [],
        3 => []
    ];

    if (!$currentUser) {
        return $levels;
    }

    $currentId =
        getReferralUserId($currentUser);

    if ($currentId === '') {
        return $levels;
    }

    $currentEmail =
        strtolower(
            refString(
                $currentUser['email'] ?? ''
            )
        );

    $currentCode =
        getReferralCode($currentUser);

    /*
     * LEVEL 1
     */
    $level1 = findDirectReferrals(
        $users,
        $currentId,
        $currentEmail,
        $currentCode
    );

    $levels[1] = $level1;

    /*
     * LEVEL 2
     */
    $level2 = [];
    $seenLevel2 = [];

    foreach ($level1 as $member) {
        $memberId =
            getReferralUserId($member);

        if ($memberId === '') {
            continue;
        }

        $memberEmail =
            strtolower(
                refString(
                    $member['email'] ?? ''
                )
            );

        $memberCode =
            getReferralCode($member);

        $children = findDirectReferrals(
            $users,
            $memberId,
            $memberEmail,
            $memberCode
        );

        foreach ($children as $child) {
            $childId =
                getReferralUserId($child);

            if ($childId === '') {
                continue;
            }

            /*
             * Never include the current user in his/her own
             * referral tree.
             */
            if (
                strtolower($childId)
                === strtolower($currentId)
            ) {
                continue;
            }

            $key = strtolower($childId);

            if (isset($seenLevel2[$key])) {
                continue;
            }

            $seenLevel2[$key] = true;

            $level2[] = $child;
        }
    }

    $levels[2] = $level2;

    /*
     * LEVEL 3
     */
    $level3 = [];
    $seenLevel3 = [];

    foreach ($level2 as $member) {
        $memberId =
            getReferralUserId($member);

        if ($memberId === '') {
            continue;
        }

        $memberEmail =
            strtolower(
                refString(
                    $member['email'] ?? ''
                )
            );

        $memberCode =
            getReferralCode($member);

        $children = findDirectReferrals(
            $users,
            $memberId,
            $memberEmail,
            $memberCode
        );

        foreach ($children as $child) {
            $childId =
                getReferralUserId($child);

            if ($childId === '') {
                continue;
            }

            if (
                strtolower($childId)
                === strtolower($currentId)
            ) {
                continue;
            }

            $key = strtolower($childId);

            if (isset($seenLevel3[$key])) {
                continue;
            }

            $seenLevel3[$key] = true;

            $level3[] = $child;
        }
    }

    $levels[3] = $level3;

    return $levels;
}

/* =========================================================
   FORMAT MEMBER
   ========================================================= */

function formatReferralMember($member): array
{
    $id =
        getReferralUserId($member);

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

    if ($fullName === '') {
        $fullName =
            trim(
                $firstName
                . ' '
                . $lastName
            );
    }

    if ($fullName === '') {
        $fullName = 'Crown Cash User';
    }

    $email =
        refString(
            $member['email'] ?? ''
        );

    $phone =
        refString(
            $member['phone']
            ?? $member['phone_number']
            ?? $member['phoneNumber']
            ?? ''
        );

    $createdAt =
        $member['created_at']
        ?? $member['createdAt']
        ?? null;

    $createdAtIso = null;

    if ($createdAt instanceof UTCDateTime) {
        $createdAtIso =
            $createdAt
                ->toDateTime()
                ->format('c');
    } elseif ($createdAt instanceof \DateTimeInterface) {
        $createdAtIso =
            $createdAt->format('c');
    } elseif (
        is_string($createdAt)
        && trim($createdAt) !== ''
    ) {
        try {
            $createdAtIso =
                (new DateTime(
                    $createdAt,
                    new DateTimeZone('UTC')
                ))->format('c');
        } catch (Throwable $e) {
            $createdAtIso = null;
        }
    }

    return [
        'id' => $id,
        '_id' => $id,
        'name' => $fullName,
        'full_name' => $fullName,
        'firstName' => $firstName,
        'lastName' => $lastName,
        'email' => $email,
        'phone' => $phone,
        'created_at' => $createdAtIso
    ];
}

/* =========================================================
   COMMISSION TOTALS
   ========================================================= */

function getUserCommissionTotals($user): array
{
    $l1 = 0.0;
    $l2 = 0.0;
    $l3 = 0.0;

    if ($user) {
        $l1 = refMoney(
            $user['l1_earnings']
            ?? $user['level1_earnings']
            ?? $user['level_1_earnings']
            ?? 0
        );

        $l2 = refMoney(
            $user['l2_earnings']
            ?? $user['level2_earnings']
            ?? $user['level_2_earnings']
            ?? 0
        );

        $l3 = refMoney(
            $user['l3_earnings']
            ?? $user['level3_earnings']
            ?? $user['level_3_earnings']
            ?? 0
        );
    }

    /*
     * The authoritative fields written by daily_earnings.php
     * are L1/L2/L3.
     */
    $total =
        round(
            $l1 + $l2 + $l3,
            2
        );

    return [
        'l1' => $l1,
        'l2' => $l2,
        'l3' => $l3,
        'total' => $total
    ];
}

/* =========================================================
   OPTIONAL LEDGER FALLBACK
   ========================================================= */

function getLedgerReferralTotals(
    $earnings,
    string $userId
): array {
    if ($userId === '') {
        return [
            'l1' => 0.0,
            'l2' => 0.0,
            'l3' => 0.0,
            'total' => 0.0
        ];
    }

    $conditions = [];

    $oid = refObjectId($userId);

    if ($oid !== null) {
        $conditions[] = [
            'user_id' => $oid
        ];
    }

    $conditions[] = [
        'user_id' => $userId
    ];

    $conditions[] = [
        'userId' => $userId
    ];

    try {
        $cursor = $earnings->find([
            '$and' => [
                [
                    '$or' => $conditions
                ],
                [
                    '$or' => [
                        [
                            'type' => 'referral_commission'
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
        ]);

        $totals = [
            'l1' => 0.0,
            'l2' => 0.0,
            'l3' => 0.0
        ];

        foreach ($cursor as $entry) {
            $level =
                (int) refMoney(
                    $entry['level']
                    ?? 0
                );

            if ($level < 1 || $level > 3) {
                $type =
                    strtolower(
                        refString(
                            $entry['earning_type']
                            ?? $entry['category']
                            ?? ''
                        )
                    );

                if (str_contains($type, 'l1')) {
                    $level = 1;
                } elseif (str_contains($type, 'l2')) {
                    $level = 2;
                } elseif (str_contains($type, 'l3')) {
                    $level = 3;
                }
            }

            $amount =
                refMoney(
                    $entry['amount']
                    ?? $entry['earning']
                    ?? 0
                );

            if ($level === 1) {
                $totals['l1'] += $amount;
            } elseif ($level === 2) {
                $totals['l2'] += $amount;
            } elseif ($level === 3) {
                $totals['l3'] += $amount;
            }
        }

        $totals['l1'] =
            round($totals['l1'], 2);

        $totals['l2'] =
            round($totals['l2'], 2);

        $totals['l3'] =
            round($totals['l3'], 2);

        $totals['total'] =
            round(
                $totals['l1']
                + $totals['l2']
                + $totals['l3'],
                2
            );

        return $totals;
    } catch (Throwable $e) {
        return [
            'l1' => 0.0,
            'l2' => 0.0,
            'l3' => 0.0,
            'total' => 0.0
        ];
    }
}

/* =========================================================
   GENERATE REFERRAL LINK
   ========================================================= */

function buildReferralLink(string $code): string
{
    if ($code === '') {
        return '';
    }

    return 'https://crown-cash.vercel.app/?ref='
        . rawurlencode($code);
}

/* =========================================================
   MAIN REQUEST
   ========================================================= */

try {
    $userId =
        referralSessionUserId();

    $email =
        referralSessionEmail();

    $user =
        findReferralUser(
            $users,
            $userId,
            $email
        );

    if (!$user) {
        referralResponse(
            false,
            'Please log in to view your referral information.',
            [],
            401
        );
    }

    $actualUserId =
        getReferralUserId($user);

    if ($actualUserId === '') {
        referralResponse(
            false,
            'Your user account ID could not be determined.',
            [],
            400
        );
    }

    /*
     * ---------------------------------------------------------
     * REFERRAL CODE
     * ---------------------------------------------------------
     */
    $referralCode =
        getReferralCode($user);

    /*
     * If no code exists, use a deterministic Crown Cash code
     * based on the user ID. We do not modify the database here.
     */
    if ($referralCode === '') {
        $referralCode =
            'CC'
            . strtoupper(
                substr(
                    hash(
                        'sha256',
                        $actualUserId
                    ),
                    0,
                    10
                )
            );
    }

    $referralLink =
        buildReferralLink(
            $referralCode
        );

    /*
     * ---------------------------------------------------------
     * BUILD TEAM
     * ---------------------------------------------------------
     */
    $levels =
        buildReferralLevels(
            $users,
            $user
        );

    $level1Members = [];

    foreach ($levels[1] as $member) {
        $level1Members[] =
            formatReferralMember(
                $member
            );
    }

    $level2Members = [];

    foreach ($levels[2] as $member) {
        $level2Members[] =
            formatReferralMember(
                $member
            );
    }

    $level3Members = [];

    foreach ($levels[3] as $member) {
        $level3Members[] =
            formatReferralMember(
                $member
            );
    }

    /*
     * ---------------------------------------------------------
     * COUNTS
     * ---------------------------------------------------------
     */
    $l1Count =
        count($level1Members);

    $l2Count =
        count($level2Members);

    $l3Count =
        count($level3Members);

    $teamCount =
        $l1Count
        + $l2Count
        + $l3Count;

    /*
     * ---------------------------------------------------------
     * COMMISSIONS
     * ---------------------------------------------------------
     */
    $userTotals =
        getUserCommissionTotals(
            $user
        );

    /*
     * Use ledger data if the user totals have not yet been
     * populated but daily_earnings.php has already recorded
     * commissions.
     */
    $ledgerTotals =
        getLedgerReferralTotals(
            $earnings,
            $actualUserId
        );

    if (
        $userTotals['total'] <= 0
        && $ledgerTotals['total'] > 0
    ) {
        $userTotals =
            $ledgerTotals;
    }

    /*
     * ---------------------------------------------------------
     * BALANCE
     * ---------------------------------------------------------
     */
    $balance = 0.0;

    if (
        isset($user['balance'])
        && is_numeric($user['balance'])
    ) {
        $balance =
            refMoney(
                $user['balance']
            );
    } elseif (
        isset($user['wallet_balance'])
        && is_numeric($user['wallet_balance'])
    ) {
        $balance =
            refMoney(
                $user['wallet_balance']
            );
    } elseif (
        isset($user['walletBalance'])
        && is_numeric($user['walletBalance'])
    ) {
        $balance =
            refMoney(
                $user['walletBalance']
            );
    } elseif (
        isset($user['wallet'])
        && is_array($user['wallet'])
        && isset($user['wallet']['balance'])
    ) {
        $balance =
            refMoney(
                $user['wallet']['balance']
            );
    }

    /*
     * ---------------------------------------------------------
     * USER DISPLAY INFORMATION
     * ---------------------------------------------------------
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

    if ($fullName === '') {
        $fullName =
            trim(
                $firstName
                . ' '
                . $lastName
            );
    }

    /*
     * ---------------------------------------------------------
     * RESPONSE
     * ---------------------------------------------------------
     */
    $responseData = [
        'user' => [
            'id' => $actualUserId,
            'name' => $fullName,
            'email' => refString(
                $user['email'] ?? ''
            ),
            'balance' => $balance
        ],

        'referral' => [
            'code' => $referralCode,
            'referral_code' => $referralCode,
            'link' => $referralLink,
            'referral_link' => $referralLink,

            'rates' => [
                'l1' => 15,
                'l2' => 5,
                'l3' => 2
            ],

            'commission_rates' => [
                'level1' => 15,
                'level2' => 5,
                'level3' => 2
            ],

            'team' => [
                'level1' => $level1Members,
                'level2' => $level2Members,
                'level3' => $level3Members,
                'all' => array_merge(
                    $level1Members,
                    $level2Members,
                    $level3Members
                )
            ],

            'members' => [
                'l1' => $level1Members,
                'l2' => $level2Members,
                'l3' => $level3Members
            ],

            'counts' => [
                'l1' => $l1Count,
                'l2' => $l2Count,
                'l3' => $l3Count,
                'total' => $teamCount,
                'team' => $teamCount
            ],

            'earnings' => [
                'l1' => $userTotals['l1'],
                'l2' => $userTotals['l2'],
                'l3' => $userTotals['l3'],
                'total' => $userTotals['total']
            ],

            'l1_earnings' =>
                $userTotals['l1'],

            'l2_earnings' =>
                $userTotals['l2'],

            'l3_earnings' =>
                $userTotals['l3'],

            'total_earnings' =>
                $userTotals['total']
        ],

        /*
         * Also expose these fields at the top level for
         * compatibility with existing frontend JavaScript.
         */
        'referral_code' => $referralCode,
        'referral_link' => $referralLink,

        'l1_count' => $l1Count,
        'l2_count' => $l2Count,
        'l3_count' => $l3Count,
        'team_count' => $teamCount,

        'l1_earnings' =>
            $userTotals['l1'],

        'l2_earnings' =>
            $userTotals['l2'],

        'l3_earnings' =>
            $userTotals['l3'],

        'referral_earnings' =>
            $userTotals['total'],

        'total_referral_earnings' =>
            $userTotals['total']
    ];

    referralResponse(
        true,
        'Referral information loaded successfully.',
        $responseData
    );
} catch (Throwable $e) {
    referralResponse(
        false,
        'Unable to load referral information.',
        [
            'error' => $e->getMessage()
        ],
        500
    );
}