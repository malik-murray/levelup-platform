/**
 * Maps Plaid personal_finance_category (PFCv2 / PFCv1 detailed codes) to LevelUp
 * flattened leaf category names (see supabase/migrations/095_flatten_budget_category_taxonomy.sql).
 * Returns null when we should not auto-label (transfers, loan disbursements, unknown codes).
 */

const SKIP_DETAILED_PREFIXES = ['TRANSFER_IN_', 'TRANSFER_OUT_', 'LOAN_DISBURSEMENTS_'] as const;

/** Plaid `detailed` code -> exact `categories.name` for kind=category rows (user taxonomy). */
export const PLAID_PFC_DETAILED_TO_LEAF_NAME: Record<string, string> = {
    // INCOME
    INCOME_CHILD_SUPPORT: 'Job 2',
    INCOME_CONTRACTOR: 'Job 1',
    INCOME_DIVIDENDS: 'Dividend/Interest',
    INCOME_GIG_ECONOMY: 'Job 2',
    INCOME_INTEREST_EARNED: 'Dividend/Interest',
    INCOME_LONG_TERM_DISABILITY: 'Job 2',
    INCOME_MILITARY: 'Job 1',
    INCOME_RENTAL: 'Job 2',
    INCOME_RETIREMENT_PENSION: 'Job 2',
    INCOME_SALARY: 'Job 1',
    INCOME_TAX_REFUND: 'Job 2',
    INCOME_UNEMPLOYMENT: 'Job 2',
    INCOME_OTHER: 'Job 2',
    // PFCv1 legacy (still seen in the wild)
    INCOME_WAGES: 'Job 1',
    INCOME_OTHER_INCOME: 'Job 2',

    // LOAN PAYMENTS
    LOAN_PAYMENTS_BNPL: 'Business',
    LOAN_PAYMENTS_CAR_PAYMENT: 'Transportation',
    LOAN_PAYMENTS_CASH_ADVANCES: 'Business',
    LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'Business',
    LOAN_PAYMENTS_EWA: 'Business',
    LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'Rent',
    LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: 'Business',
    LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: 'Education',
    LOAN_PAYMENTS_OTHER_PAYMENT: 'Business',

    // BANK FEES
    BANK_FEES_ATM_FEES: 'Business',
    BANK_FEES_INSUFFICIENT_FUNDS: 'Business',
    BANK_FEES_INTEREST_CHARGE: 'Business',
    BANK_FEES_FOREIGN_TRANSACTION_FEES: 'Business',
    BANK_FEES_OVERDRAFT_FEES: 'Business',
    BANK_FEES_LATE_FEES: 'Business',
    BANK_FEES_CASH_ADVANCE: 'Business',
    BANK_FEES_OTHER_BANK_FEES: 'Business',

    // ENTERTAINMENT
    ENTERTAINMENT_CASINOS_AND_GAMBLING: 'Entertainment',
    ENTERTAINMENT_MUSIC_AND_AUDIO: 'Subscriptions',
    ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'Entertainment',
    ENTERTAINMENT_TV_AND_MOVIES: 'Entertainment',
    ENTERTAINMENT_VIDEO_GAMES: 'Entertainment',
    ENTERTAINMENT_OTHER_ENTERTAINMENT: 'Entertainment',

    // FOOD_AND_DRINK
    FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'Dining Out',
    FOOD_AND_DRINK_COFFEE: 'Dining Out',
    FOOD_AND_DRINK_FAST_FOOD: 'Dining Out',
    FOOD_AND_DRINK_GROCERIES: 'Groceries',
    FOOD_AND_DRINK_RESTAURANT: 'Dining Out',
    FOOD_AND_DRINK_VENDING_MACHINES: 'Snacks',
    FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: 'Dining Out',

    // GENERAL MERCHANDISE
    GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'Education',
    GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'Entertainment',
    GENERAL_MERCHANDISE_CONVENIENCE_STORES: 'Groceries',
    GENERAL_MERCHANDISE_DEPARTMENT_STORES: 'Entertainment',
    GENERAL_MERCHANDISE_DISCOUNT_STORES: 'Entertainment',
    GENERAL_MERCHANDISE_ELECTRONICS: 'Entertainment',
    GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: 'Gifts',
    GENERAL_MERCHANDISE_OFFICE_SUPPLIES: 'Business',
    GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: 'Entertainment',
    GENERAL_MERCHANDISE_PET_SUPPLIES: 'Entertainment',
    GENERAL_MERCHANDISE_SPORTING_GOODS: 'Entertainment',
    GENERAL_MERCHANDISE_SUPERSTORES: 'Entertainment',
    GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: 'Entertainment',
    GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: 'Entertainment',

    // HOME
    HOME_IMPROVEMENT_FURNITURE: 'Rent',
    HOME_IMPROVEMENT_HARDWARE: 'Rent',
    HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: 'Rent',
    HOME_IMPROVEMENT_SECURITY: 'Rent',
    HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: 'Rent',

    // MEDICAL
    MEDICAL_DENTAL_CARE: 'Health/Fitness',
    MEDICAL_EYE_CARE: 'Health/Fitness',
    MEDICAL_NURSING_CARE: 'Health/Fitness',
    MEDICAL_PHARMACIES_AND_SUPPLEMENTS: 'Health/Fitness',
    MEDICAL_PRIMARY_CARE: 'Health/Fitness',
    MEDICAL_VETERINARY_SERVICES: 'Health/Fitness',
    MEDICAL_OTHER_MEDICAL: 'Health/Fitness',

    // PERSONAL CARE
    PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'Health/Fitness',
    PERSONAL_CARE_HAIR_AND_BEAUTY: 'Health/Fitness',
    PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: 'Health/Fitness',
    PERSONAL_CARE_OTHER_PERSONAL_CARE: 'Health/Fitness',

    // GENERAL SERVICES
    GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: 'Business',
    GENERAL_SERVICES_AUTOMOTIVE: 'Transportation',
    GENERAL_SERVICES_CHILDCARE: 'Child Support',
    GENERAL_SERVICES_CONSULTING_AND_LEGAL: 'Business',
    GENERAL_SERVICES_EDUCATION: 'Education',
    GENERAL_SERVICES_INSURANCE: 'Insurance',
    GENERAL_SERVICES_POSTAGE_AND_SHIPPING: 'Business',
    GENERAL_SERVICES_STORAGE: 'Rent',
    GENERAL_SERVICES_OTHER_GENERAL_SERVICES: 'Needs Review',

    // GOVERNMENT / NONPROFIT
    GOVERNMENT_AND_NON_PROFIT_DONATIONS: 'Gifts',
    GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: 'Needs Review',
    GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: 'Business',
    GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: 'Needs Review',

    // TRANSPORTATION
    TRANSPORTATION_BIKES_AND_SCOOTERS: 'Transportation',
    TRANSPORTATION_GAS: 'Transportation',
    TRANSPORTATION_PARKING: 'Transportation',
    TRANSPORTATION_PUBLIC_TRANSIT: 'Transportation',
    TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'Transportation',
    TRANSPORTATION_TOLLS: 'Transportation',
    TRANSPORTATION_OTHER_TRANSPORTATION: 'Transportation',

    // TRAVEL
    TRAVEL_FLIGHTS: 'Transportation',
    TRAVEL_LODGING: 'Transportation',
    TRAVEL_RENTAL_CARS: 'Transportation',
    TRAVEL_OTHER_TRAVEL: 'Transportation',

    // RENT & UTILITIES
    RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: 'Utilities',
    RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'Wi-Fi',
    RENT_AND_UTILITIES_RENT: 'Rent',
    RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: 'Utilities',
    RENT_AND_UTILITIES_TELEPHONE: 'Phone',
    RENT_AND_UTILITIES_WATER: 'Utilities',
    RENT_AND_UTILITIES_OTHER_UTILITIES: 'Utilities',

    OTHER_OTHER: 'Needs Review',
};

/** When `detailed` is missing, map Plaid `primary` to a reasonable default leaf. */
const PLAID_PFC_PRIMARY_DEFAULT_LEAF: Record<string, string> = {
    INCOME: 'Job 2',
    LOAN_PAYMENTS: 'Business',
    BANK_FEES: 'Business',
    ENTERTAINMENT: 'Entertainment',
    FOOD_AND_DRINK: 'Dining Out',
    GENERAL_MERCHANDISE: 'Entertainment',
    HOME_IMPROVEMENT: 'Rent',
    MEDICAL: 'Health/Fitness',
    PERSONAL_CARE: 'Health/Fitness',
    GENERAL_SERVICES: 'Needs Review',
    GOVERNMENT_AND_NON_PROFIT: 'Needs Review',
    TRANSPORTATION: 'Transportation',
    TRAVEL: 'Transportation',
    RENT_AND_UTILITIES: 'Utilities',
    OTHER: 'Needs Review',
};

export function leafCategoryNameFromPlaidPfc(
    primary: string | null | undefined,
    detailed: string | null | undefined
): string | null {
    const d = (detailed || '').trim().toUpperCase();
    const p = (primary || '').trim().toUpperCase();

    if (d && SKIP_DETAILED_PREFIXES.some(pref => d.startsWith(pref))) {
        return null;
    }
    if (d && PLAID_PFC_DETAILED_TO_LEAF_NAME[d]) {
        return PLAID_PFC_DETAILED_TO_LEAF_NAME[d];
    }
    if (p && PLAID_PFC_PRIMARY_DEFAULT_LEAF[p]) {
        return PLAID_PFC_PRIMARY_DEFAULT_LEAF[p];
    }
    return null;
}
