/**
 * Types for Financial Concierge feature
 */

// ============================================================
// USER SURVEY & PROFILE
// ============================================================

export type SurveyGoal =
    | 'debt_payoff'
    | 'saving'
    | 'investing'
    | 'spend_control'
    | 'rebuild_credit'
    | 'buy_house'
    | 'buy_car';

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export type IncomeStability = 'stable' | 'variable' | 'unstable';

export type DebtPayoffStrategy = 'avalanche' | 'snowball' | 'minimum';

export interface DebtDetail {
    apr: number; // Annual percentage rate
    due_date: number; // Day of month (1-31)
    minimum_payment: number;
    balance: number;
    account_name?: string;
}

export interface UserSurvey {
    id: string;
    user_id: string;
    
    // Goals
    goal_debt_payoff: boolean;
    goal_saving: boolean;
    goal_investing: boolean;
    goal_spend_control: boolean;
    goal_rebuild_credit: boolean;
    goal_buy_house: boolean;
    goal_buy_car: boolean;
    
    // Risk & situation
    risk_tolerance: RiskTolerance;
    income_stability: IncomeStability;
    household_size: number;
    
    // Targets
    target_savings_amount: number | null;
    target_savings_timeline_months: number | null;
    
    // Debt details
    debt_details: DebtDetail[];
    debt_payoff_strategy: DebtPayoffStrategy | null;
    
    created_at: string;
    updated_at: string;
}

export interface UserSurveyInput {
    // Goals
    goal_debt_payoff?: boolean;
    goal_saving?: boolean;
    goal_investing?: boolean;
    goal_spend_control?: boolean;
    goal_rebuild_credit?: boolean;
    goal_buy_house?: boolean;
    goal_buy_car?: boolean;
    
    // Risk & situation
    risk_tolerance?: RiskTolerance;
    income_stability?: IncomeStability;
    household_size?: number;
    
    // Targets
    target_savings_amount?: number | null;
    target_savings_timeline_months?: number | null;
    
    // Debt details
    debt_details?: DebtDetail[];
    debt_payoff_strategy?: DebtPayoffStrategy | null;
}

export type UserProfileType =
    | 'debt_payoff'
    | 'saving_focused'
    | 'investing_focused'
    | 'spend_control'
    | 'rebuild_credit'
    | 'mixed';

export type BudgetStrategy = 'zero_based' | 'envelope' | 'percentage' | '50_30_20';

export interface UserProfile {
    id: string;
    user_id: string;
    profile_type: UserProfileType;
    budget_strategy: BudgetStrategy;
    guardrails: Record<string, any>;
    preferences: Record<string, any>;
    created_at: string;
    updated_at: string;
}

// ============================================================
// STATEMENT FILES & PERIODS
// ============================================================

export type StatementFileType = 'pdf' | 'csv';

export type StatementFileStatus = 'uploaded' | 'processing' | 'processed' | 'error';

export interface StatementFile {
    id: string;
    user_id: string;
    file_name: string;
    file_type: StatementFileType;
    file_size_bytes: number;
    storage_path: string;
    account_id: string | null;
    period_start_date: string | null;
    period_end_date: string | null;
    status: StatementFileStatus;
    error_message: string | null;
    uploaded_at: string;
    processed_at: string | null;
    user_consent_given: boolean;
    consent_given_at: string | null;
}

export interface StatementPeriod {
    id: string;
    user_id: string;
    account_id: string;
    period_start_date: string;
    period_end_date: string;
    statement_file_id: string | null;
    starting_balance: number | null;
    ending_balance: number | null;
    reconciled: boolean;
    reconciled_at: string | null;
    created_at: string;
}

// ============================================================
// CATEGORIZATION
// ============================================================

export type CategorizationMethod = 'rule' | 'merchant_mapping' | 'ml_model' | 'user_override' | 'manual';

export interface MerchantMapping {
    id: string;
    user_id: string;
    merchant_name: string;
    category_id: string;
    confidence_score: number;
    source: 'user_override' | 'rule_based' | 'ml_model';
    usage_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

export type CategoryRuleType =
    | 'merchant_match'
    | 'keyword'
    | 'mcc_code'
    | 'amount_range'
    | 'recurring_pattern';

export interface CategoryRule {
    id: string;
    user_id: string | null; // null for global rules
    category_id: string;
    rule_type: CategoryRuleType;
    rule_pattern: Record<string, any>; // JSONB pattern
    priority: number;
    active: boolean;
    match_count: number;
    last_matched_at: string | null;
    created_at: string;
    updated_at: string;
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringItem {
    id: string;
    user_id: string;
    merchant_name: string;
    category_id: string | null;
    frequency: RecurringFrequency;
    expected_amount: number | null;
    tolerance_days: number;
    next_expected_date: string | null;
    active: boolean;
    confirmed_by_user: boolean;
    occurrence_count: number;
    last_occurrence_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface CategorizationResult {
    category_id: string;
    confidence: number;
    method: CategorizationMethod;
    rule_id?: string;
    merchant_mapping_id?: string;
    explanation?: string;
}

// ============================================================
// BUDGET PLANS
// ============================================================

export type BudgetPlanStatus = 'draft' | 'active' | 'archived';
export type BudgetPlanGeneratedBy = 'auto' | 'manual' | 'user_edit';

export interface BudgetPlan {
    id: string;
    user_id: string;
    month: string; // YYYY-MM
    generated_at: string;
    generated_by: BudgetPlanGeneratedBy;
    source_data_start_date: string;
    source_data_end_date: string;
    profile_type: string | null;
    status: BudgetPlanStatus;
    metadata: Record<string, any>;
}

export interface BudgetItem {
    id: string;
    budget_plan_id: string;
    category_id: string;
    amount: number;
    guardrail_adjustment: number;
    guardrail_reason: string | null;
    user_override_amount: number | null;
    user_override_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface BudgetPlanWithItems extends BudgetPlan {
    items: BudgetItem[];
}

// ============================================================
// INSIGHTS & RECOMMENDATIONS
// ============================================================

export type InsightType =
    | 'spend_trend'
    | 'recurring_subscription'
    | 'unusual_spend'
    | 'cashflow_forecast'
    | 'goal_progress'
    | 'category_overage'
    | 'opportunity';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface Insight {
    id: string;
    user_id: string;
    month: string; // YYYY-MM
    insight_type: InsightType;
    insight_data: Record<string, any>;
    severity: InsightSeverity;
    acknowledged: boolean;
    acknowledged_at: string | null;
    generated_at: string;
}

export type RecommendationType =
    | 'reduce_spending'
    | 'increase_savings'
    | 'pay_down_debt'
    | 'optimize_subscriptions'
    | 'adjust_budget'
    | 'invest_opportunity'
    | 'credit_improvement';

export type RecommendationStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface Recommendation {
    id: string;
    user_id: string;
    month: string; // YYYY-MM
    recommendation_type: RecommendationType;
    title: string;
    description: string;
    action_items: string[];
    linked_goals: SurveyGoal[];
    priority: number;
    status: RecommendationStatus;
    status_updated_at: string | null;
    generated_at: string;
}

// ============================================================
// AUDIT LOGS
// ============================================================

export type AuditActionType =
    | 'statement_upload'
    | 'statement_process'
    | 'transaction_sync'
    | 'categorization_override'
    | 'budget_generation'
    | 'data_export'
    | 'data_deletion';

export interface FinancialAuditLog {
    id: string;
    user_id: string;
    action_type: AuditActionType;
    action_details: Record<string, any>;
    resource_type: string | null;
    resource_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}










