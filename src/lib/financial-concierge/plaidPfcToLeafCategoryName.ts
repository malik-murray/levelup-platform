/**
 * Maps Plaid personal_finance_category (PFCv2 / PFCv1 detailed codes) to LevelUp
 * seeded leaf category names (see supabase/migrations/020_seed_financial_categories.sql).
 * Returns null when we should not auto-label (transfers, loan disbursements, unknown codes).
 */

const SKIP_DETAILED_PREFIXES = ['TRANSFER_IN_', 'TRANSFER_OUT_', 'LOAN_DISBURSEMENTS_'] as const;

/** Plaid `detailed` code -> exact `categories.name` for kind=category rows (global or user). */
export const PLAID_PFC_DETAILED_TO_LEAF_NAME: Record<string, string> = {
    // INCOME
    INCOME_CHILD_SUPPORT: 'Other Income',
    INCOME_CONTRACTOR: 'Wages & Salary',
    INCOME_DIVIDENDS: 'Investment Income',
    INCOME_GIG_ECONOMY: 'Wages & Salary',
    INCOME_INTEREST_EARNED: 'Investment Income',
    INCOME_LONG_TERM_DISABILITY: 'Other Income',
    INCOME_MILITARY: 'Wages & Salary',
    INCOME_RENTAL: 'Other Income',
    INCOME_RETIREMENT_PENSION: 'Other Income',
    INCOME_SALARY: 'Wages & Salary',
    INCOME_TAX_REFUND: 'Other Income',
    INCOME_UNEMPLOYMENT: 'Other Income',
    INCOME_OTHER: 'Other Income',
    // PFCv1 legacy (still seen in the wild)
    INCOME_WAGES: 'Wages & Salary',
    INCOME_OTHER_INCOME: 'Other Income',

    // LOAN PAYMENTS
    LOAN_PAYMENTS_BNPL: 'Loan Payment',
    LOAN_PAYMENTS_CAR_PAYMENT: 'Loan Payment',
    LOAN_PAYMENTS_CASH_ADVANCES: 'Loan Payment',
    LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'Credit Card Payment',
    LOAN_PAYMENTS_EWA: 'Loan Payment',
    LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'Rent/Mortgage',
    LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: 'Loan Payment',
    LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: 'Student Loan',
    LOAN_PAYMENTS_OTHER_PAYMENT: 'Loan Payment',

    // BANK FEES
    BANK_FEES_ATM_FEES: 'Bank Fees',
    BANK_FEES_INSUFFICIENT_FUNDS: 'Bank Fees',
    BANK_FEES_INTEREST_CHARGE: 'Bank Fees',
    BANK_FEES_FOREIGN_TRANSACTION_FEES: 'Bank Fees',
    BANK_FEES_OVERDRAFT_FEES: 'Bank Fees',
    BANK_FEES_LATE_FEES: 'Bank Fees',
    BANK_FEES_CASH_ADVANCE: 'Bank Fees',
    BANK_FEES_OTHER_BANK_FEES: 'Bank Fees',

    // ENTERTAINMENT
    ENTERTAINMENT_CASINOS_AND_GAMBLING: 'Hobbies',
    ENTERTAINMENT_MUSIC_AND_AUDIO: 'Streaming Services',
    ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'Concerts & Events',
    ENTERTAINMENT_TV_AND_MOVIES: 'Movies & TV',
    ENTERTAINMENT_VIDEO_GAMES: 'Hobbies',
    ENTERTAINMENT_OTHER_ENTERTAINMENT: 'Hobbies',

    // FOOD_AND_DRINK
    FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'Alcohol & Bars',
    FOOD_AND_DRINK_COFFEE: 'Coffee Shops',
    FOOD_AND_DRINK_FAST_FOOD: 'Restaurants',
    FOOD_AND_DRINK_GROCERIES: 'Groceries',
    FOOD_AND_DRINK_RESTAURANT: 'Restaurants',
    FOOD_AND_DRINK_VENDING_MACHINES: 'Restaurants',
    FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: 'Restaurants',

    // GENERAL MERCHANDISE
    GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'Books & Supplies',
    GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'Clothing',
    GENERAL_MERCHANDISE_CONVENIENCE_STORES: 'Groceries',
    GENERAL_MERCHANDISE_DEPARTMENT_STORES: 'General Shopping',
    GENERAL_MERCHANDISE_DISCOUNT_STORES: 'General Shopping',
    GENERAL_MERCHANDISE_ELECTRONICS: 'Electronics',
    GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: 'Gifts',
    GENERAL_MERCHANDISE_OFFICE_SUPPLIES: 'Books & Supplies',
    GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: 'General Shopping',
    GENERAL_MERCHANDISE_PET_SUPPLIES: 'General Shopping',
    GENERAL_MERCHANDISE_SPORTING_GOODS: 'Sports & Recreation',
    GENERAL_MERCHANDISE_SUPERSTORES: 'General Shopping',
    GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: 'General Shopping',
    GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: 'General Shopping',

    // HOME
    HOME_IMPROVEMENT_FURNITURE: 'Home Maintenance',
    HOME_IMPROVEMENT_HARDWARE: 'Home Maintenance',
    HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: 'Home Maintenance',
    HOME_IMPROVEMENT_SECURITY: 'Home Maintenance',
    HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: 'Home Maintenance',

    // MEDICAL
    MEDICAL_DENTAL_CARE: 'Dental',
    MEDICAL_EYE_CARE: 'Doctor Visits',
    MEDICAL_NURSING_CARE: 'Doctor Visits',
    MEDICAL_PHARMACIES_AND_SUPPLEMENTS: 'Pharmacy',
    MEDICAL_PRIMARY_CARE: 'Doctor Visits',
    MEDICAL_VETERINARY_SERVICES: 'Doctor Visits',
    MEDICAL_OTHER_MEDICAL: 'Doctor Visits',

    // PERSONAL CARE
    PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'Gym & Fitness',
    PERSONAL_CARE_HAIR_AND_BEAUTY: 'Hair & Beauty',
    PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: 'Personal Hygiene',
    PERSONAL_CARE_OTHER_PERSONAL_CARE: 'Personal Hygiene',

    // GENERAL SERVICES
    GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: 'Uncategorized',
    GENERAL_SERVICES_AUTOMOTIVE: 'Car Maintenance',
    GENERAL_SERVICES_CHILDCARE: 'Uncategorized',
    GENERAL_SERVICES_CONSULTING_AND_LEGAL: 'Uncategorized',
    GENERAL_SERVICES_EDUCATION: 'Tuition',
    GENERAL_SERVICES_INSURANCE: 'Health Insurance',
    GENERAL_SERVICES_POSTAGE_AND_SHIPPING: 'General Shopping',
    GENERAL_SERVICES_STORAGE: 'Home Maintenance',
    GENERAL_SERVICES_OTHER_GENERAL_SERVICES: 'Uncategorized',

    // GOVERNMENT / NONPROFIT
    GOVERNMENT_AND_NON_PROFIT_DONATIONS: 'Charity',
    GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: 'Uncategorized',
    GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: 'Property Taxes',
    GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: 'Uncategorized',

    // TRANSPORTATION
    TRANSPORTATION_BIKES_AND_SCOOTERS: 'Public Transit',
    TRANSPORTATION_GAS: 'Gas',
    TRANSPORTATION_PARKING: 'Parking',
    TRANSPORTATION_PUBLIC_TRANSIT: 'Public Transit',
    TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'Public Transit',
    TRANSPORTATION_TOLLS: 'Parking',
    TRANSPORTATION_OTHER_TRANSPORTATION: 'Car Maintenance',

    // TRAVEL -> Transportation (merged taxonomy)
    TRAVEL_FLIGHTS: 'Transportation',
    TRAVEL_LODGING: 'Transportation',
    TRAVEL_RENTAL_CARS: 'Car Maintenance',
    TRAVEL_OTHER_TRAVEL: 'Transportation',

    // RENT & UTILITIES
    RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: 'Utilities',
    RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'Utilities',
    RENT_AND_UTILITIES_RENT: 'Rent/Mortgage',
    RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: 'Utilities',
    RENT_AND_UTILITIES_TELEPHONE: 'Utilities',
    RENT_AND_UTILITIES_WATER: 'Utilities',
    RENT_AND_UTILITIES_OTHER_UTILITIES: 'Utilities',

    OTHER_OTHER: 'Uncategorized',
};

/** When `detailed` is missing, map Plaid `primary` to a reasonable default leaf. */
const PLAID_PFC_PRIMARY_DEFAULT_LEAF: Record<string, string> = {
    INCOME: 'Other Income',
    LOAN_PAYMENTS: 'Loan Payment',
    BANK_FEES: 'Bank Fees',
    ENTERTAINMENT: 'Movies & TV',
    FOOD_AND_DRINK: 'Restaurants',
    GENERAL_MERCHANDISE: 'General Shopping',
    HOME_IMPROVEMENT: 'Home Maintenance',
    MEDICAL: 'Doctor Visits',
    PERSONAL_CARE: 'Personal Hygiene',
    GENERAL_SERVICES: 'Uncategorized',
    GOVERNMENT_AND_NON_PROFIT: 'Uncategorized',
    TRANSPORTATION: 'Gas',
    TRAVEL: 'Transportation',
    RENT_AND_UTILITIES: 'Utilities',
    OTHER: 'Uncategorized',
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
