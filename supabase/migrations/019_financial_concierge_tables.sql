-- Migration: Financial Concierge tables
-- This migration adds all tables needed for the Financial Concierge feature

-- ============================================================
-- 1. USER SURVEY & PROFILE
-- ============================================================

-- User financial survey responses
CREATE TABLE IF NOT EXISTS user_survey (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Goals (can be multiple)
    goal_debt_payoff BOOLEAN NOT NULL DEFAULT false,
    goal_saving BOOLEAN NOT NULL DEFAULT false,
    goal_investing BOOLEAN NOT NULL DEFAULT false,
    goal_spend_control BOOLEAN NOT NULL DEFAULT false,
    goal_rebuild_credit BOOLEAN NOT NULL DEFAULT false,
    goal_buy_house BOOLEAN NOT NULL DEFAULT false,
    goal_buy_car BOOLEAN NOT NULL DEFAULT false,
    
    -- Risk tolerance
    risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')) NOT NULL DEFAULT 'moderate',
    
    -- Financial situation
    income_stability TEXT CHECK (income_stability IN ('stable', 'variable', 'unstable')) NOT NULL DEFAULT 'stable',
    household_size INTEGER NOT NULL DEFAULT 1,
    
    -- Targets
    target_savings_amount DECIMAL(12, 2),
    target_savings_timeline_months INTEGER,
    
    -- Debt details (JSONB for flexibility: array of {apr, due_date, minimum_payment, balance})
    debt_details JSONB DEFAULT '[]'::jsonb,
    
    -- Debt payoff strategy preference
    debt_payoff_strategy TEXT CHECK (debt_payoff_strategy IN ('avalanche', 'snowball', 'minimum')) DEFAULT 'minimum',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One survey per user (latest is the active one)
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_survey_user_id ON user_survey(user_id);

-- User profile derived from survey
CREATE TABLE IF NOT EXISTS user_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Profile type derived from survey
    profile_type TEXT CHECK (profile_type IN (
        'debt_payoff', 
        'saving_focused', 
        'investing_focused', 
        'spend_control', 
        'rebuild_credit',
        'mixed'
    )) NOT NULL DEFAULT 'mixed',
    
    -- Budget strategy preferences
    budget_strategy TEXT CHECK (budget_strategy IN (
        'zero_based',
        'envelope',
        'percentage',
        '50_30_20'
    )) NOT NULL DEFAULT 'zero_based',
    
    -- Financial guardrails (JSONB for flexibility)
    guardrails JSONB DEFAULT '{}'::jsonb,
    
    -- Preferences
    preferences JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_profile_type ON user_profile(profile_type);

-- ============================================================
-- 2. STATEMENT FILES & PERIODS
-- ============================================================

-- Statement files uploaded by users
CREATE TABLE IF NOT EXISTS statement_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File metadata
    file_name TEXT NOT NULL,
    file_type TEXT CHECK (file_type IN ('pdf', 'csv')) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    
    -- Storage location (path in private storage bucket)
    storage_path TEXT NOT NULL,
    
    -- Account this statement is for
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Statement period (if extracted)
    period_start_date DATE,
    period_end_date DATE,
    
    -- Processing status
    status TEXT CHECK (status IN ('uploaded', 'processing', 'processed', 'error')) NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    
    -- Audit fields
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    -- Consent and security
    user_consent_given BOOLEAN NOT NULL DEFAULT false,
    consent_given_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_statement_files_user_id ON statement_files(user_id);
CREATE INDEX IF NOT EXISTS idx_statement_files_account_id ON statement_files(account_id);
CREATE INDEX IF NOT EXISTS idx_statement_files_status ON statement_files(status);

-- Statement periods (tracked separately for reconciliation)
CREATE TABLE IF NOT EXISTS statement_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Period dates
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    
    -- Statement info
    statement_file_id UUID REFERENCES statement_files(id) ON DELETE SET NULL,
    
    -- Balance information
    starting_balance DECIMAL(12, 2),
    ending_balance DECIMAL(12, 2),
    
    -- Reconciliation status
    reconciled BOOLEAN NOT NULL DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, account_id, period_start_date, period_end_date)
);

CREATE INDEX IF NOT EXISTS idx_statement_periods_user_id ON statement_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_statement_periods_account_id ON statement_periods(account_id);

-- ============================================================
-- 3. CATEGORIZATION ENGINE
-- ============================================================

-- Merchant mappings (user overrides for categorization)
CREATE TABLE IF NOT EXISTS merchant_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Merchant identifier (normalized merchant name)
    merchant_name TEXT NOT NULL,
    
    -- Mapping target
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Confidence and metadata
    confidence_score DECIMAL(3, 2) DEFAULT 1.0, -- 0.0 to 1.0
    source TEXT CHECK (source IN ('user_override', 'rule_based', 'ml_model')) NOT NULL DEFAULT 'user_override',
    
    -- Usage tracking
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, merchant_name)
);

CREATE INDEX IF NOT EXISTS idx_merchant_mappings_user_id ON merchant_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_mappings_merchant_name ON merchant_mappings(merchant_name);
CREATE INDEX IF NOT EXISTS idx_merchant_mappings_category_id ON merchant_mappings(category_id);

-- Category rules (for rule-based categorization)
CREATE TABLE IF NOT EXISTS category_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for global rules
    
    -- Rule target
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Rule type
    rule_type TEXT CHECK (rule_type IN ('merchant_match', 'keyword', 'mcc_code', 'amount_range', 'recurring_pattern')) NOT NULL,
    
    -- Rule pattern (JSONB for flexibility)
    -- merchant_match: {"pattern": "AMAZON", "case_sensitive": false}
    -- keyword: {"keywords": ["grocery", "food"], "match_all": false}
    -- mcc_code: {"mcc_codes": [5411, 5812]}
    -- amount_range: {"min": 0, "max": 100, "currency": "USD"}
    -- recurring_pattern: {"frequency": "monthly", "tolerance_days": 3}
    rule_pattern JSONB NOT NULL,
    
    -- Priority (higher = checked first)
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Active flag
    active BOOLEAN NOT NULL DEFAULT true,
    
    -- Usage stats
    match_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_category_id ON category_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_rule_type ON category_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_category_rules_active ON category_rules(active);

-- Recurring items detected
CREATE TABLE IF NOT EXISTS recurring_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Identification
    merchant_name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Pattern detection
    frequency TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')) NOT NULL,
    expected_amount DECIMAL(12, 2),
    tolerance_days INTEGER NOT NULL DEFAULT 3,
    
    -- Next expected occurrence
    next_expected_date DATE,
    
    -- Status
    active BOOLEAN NOT NULL DEFAULT true,
    confirmed_by_user BOOLEAN NOT NULL DEFAULT false,
    
    -- Statistics
    occurrence_count INTEGER NOT NULL DEFAULT 0,
    last_occurrence_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, merchant_name)
);

CREATE INDEX IF NOT EXISTS idx_recurring_items_user_id ON recurring_items(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_merchant_name ON recurring_items(merchant_name);
CREATE INDEX IF NOT EXISTS idx_recurring_items_next_expected_date ON recurring_items(next_expected_date);

-- ============================================================
-- 4. BUDGET PLANS
-- ============================================================

-- Budget plans (monthly budgets generated by BudgetEngine)
CREATE TABLE IF NOT EXISTS budget_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Plan period
    month TEXT NOT NULL, -- Format: YYYY-MM
    
    -- Generation metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by TEXT CHECK (generated_by IN ('auto', 'manual', 'user_edit')) NOT NULL DEFAULT 'auto',
    
    -- Source data period used for generation
    source_data_start_date DATE NOT NULL,
    source_data_end_date DATE NOT NULL,
    
    -- Profile type used for guardrails
    profile_type TEXT,
    
    -- Status
    status TEXT CHECK (status IN ('draft', 'active', 'archived')) NOT NULL DEFAULT 'draft',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_budget_plans_user_id ON budget_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_plans_month ON budget_plans(month);
CREATE INDEX IF NOT EXISTS idx_budget_plans_status ON budget_plans(status);

-- Partial unique index: only one active budget plan per user per month
CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_plans_user_month_active 
    ON budget_plans(user_id, month) 
    WHERE status = 'active';

-- Budget items (individual category budgets within a plan)
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_plan_id UUID NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    
    -- Budget amount
    amount DECIMAL(12, 2) NOT NULL,
    
    -- Guardrail adjustments
    guardrail_adjustment DECIMAL(12, 2) DEFAULT 0,
    guardrail_reason TEXT,
    
    -- User overrides
    user_override_amount DECIMAL(12, 2),
    user_override_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(budget_plan_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_items_budget_plan_id ON budget_items(budget_plan_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_category_id ON budget_items(category_id);

-- ============================================================
-- 5. INSIGHTS & RECOMMENDATIONS
-- ============================================================

-- Insights generated by InsightEngine
CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Insight period
    month TEXT NOT NULL, -- Format: YYYY-MM
    
    -- Insight type
    insight_type TEXT CHECK (insight_type IN (
        'spend_trend',
        'recurring_subscription',
        'unusual_spend',
        'cashflow_forecast',
        'goal_progress',
        'category_overage',
        'opportunity'
    )) NOT NULL,
    
    -- Insight data (JSONB for flexibility)
    insight_data JSONB NOT NULL,
    
    -- Severity/importance
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL DEFAULT 'info',
    
    -- Status
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    
    -- Generation metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_month ON insights(month);
CREATE INDEX IF NOT EXISTS idx_insights_insight_type ON insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_acknowledged ON insights(acknowledged);

-- Expression unique index: prevent duplicate insights per user/month/type/key
-- Only applies when insight_data contains a 'key' field
CREATE UNIQUE INDEX IF NOT EXISTS uq_insights_user_month_type_key 
    ON insights(user_id, month, insight_type, ((insight_data ->> 'key')))
    WHERE insight_data ? 'key';

-- Recommendations (actionable suggestions)
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Recommendation period
    month TEXT NOT NULL, -- Format: YYYY-MM
    
    -- Recommendation type
    recommendation_type TEXT CHECK (recommendation_type IN (
        'reduce_spending',
        'increase_savings',
        'pay_down_debt',
        'optimize_subscriptions',
        'adjust_budget',
        'invest_opportunity',
        'credit_improvement'
    )) NOT NULL,
    
    -- Recommendation details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    action_items JSONB DEFAULT '[]'::jsonb, -- Array of action items
    
    -- Linked to survey goals
    linked_goals TEXT[] DEFAULT '{}', -- Array of goal types
    
    -- Priority
    priority INTEGER NOT NULL DEFAULT 0, -- Higher = more important
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')) NOT NULL DEFAULT 'pending',
    status_updated_at TIMESTAMPTZ,
    
    -- Generation metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, month, recommendation_type, title) -- Prevent duplicates
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_month ON recommendations(month);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority DESC);

-- ============================================================
-- 6. AUDIT LOGS
-- ============================================================

-- Audit log for data imports and sensitive operations
CREATE TABLE IF NOT EXISTS financial_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Action type
    action_type TEXT CHECK (action_type IN (
        'statement_upload',
        'statement_process',
        'transaction_sync',
        'categorization_override',
        'budget_generation',
        'data_export',
        'data_deletion'
    )) NOT NULL,
    
    -- Action details
    action_details JSONB DEFAULT '{}'::jsonb,
    
    -- Resource references
    resource_type TEXT, -- 'statement_file', 'transaction', 'budget_plan', etc.
    resource_id UUID,
    
    -- IP and user agent for security
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_user_id ON financial_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_action_type ON financial_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_created_at ON financial_audit_log(created_at DESC);

-- ============================================================
-- 7. ADD COLUMNS TO EXISTING TABLES
-- ============================================================

-- Add categorization metadata to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS categorization_confidence DECIMAL(3, 2), -- 0.0 to 1.0
ADD COLUMN IF NOT EXISTS categorization_method TEXT CHECK (categorization_method IN ('rule', 'merchant_mapping', 'ml_model', 'user_override', 'manual')),
ADD COLUMN IF NOT EXISTS categorization_rule_id UUID REFERENCES category_rules(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS categorization_merchant_mapping_id UUID REFERENCES merchant_mappings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_categorization_method ON transactions(categorization_method);
CREATE INDEX IF NOT EXISTS idx_transactions_categorization_confidence ON transactions(categorization_confidence);

-- Add statement import tracking to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS statement_file_id UUID REFERENCES statement_files(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS statement_period_id UUID REFERENCES statement_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_statement_file_id ON transactions(statement_file_id);
CREATE INDEX IF NOT EXISTS idx_transactions_statement_period_id ON transactions(statement_period_id);

-- ============================================================
-- 8. ENABLE RLS (ROW LEVEL SECURITY)
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE user_survey ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_survey
CREATE POLICY "Users can view their own survey"
    ON user_survey FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own survey"
    ON user_survey FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own survey"
    ON user_survey FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for user_profile
CREATE POLICY "Users can view their own profile"
    ON user_profile FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON user_profile FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON user_profile FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for statement_files
CREATE POLICY "Users can view their own statement files"
    ON statement_files FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own statement files"
    ON statement_files FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own statement files"
    ON statement_files FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own statement files"
    ON statement_files FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for statement_periods
CREATE POLICY "Users can view their own statement periods"
    ON statement_periods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own statement periods"
    ON statement_periods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own statement periods"
    ON statement_periods FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for merchant_mappings
CREATE POLICY "Users can view their own merchant mappings"
    ON merchant_mappings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own merchant mappings"
    ON merchant_mappings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merchant mappings"
    ON merchant_mappings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own merchant mappings"
    ON merchant_mappings FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for category_rules (user-specific rules)
CREATE POLICY "Users can view their own category rules"
    ON category_rules FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL); -- NULL = global rules

CREATE POLICY "Users can insert their own category rules"
    ON category_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category rules"
    ON category_rules FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category rules"
    ON category_rules FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for recurring_items
CREATE POLICY "Users can view their own recurring items"
    ON recurring_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring items"
    ON recurring_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring items"
    ON recurring_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring items"
    ON recurring_items FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for budget_plans
CREATE POLICY "Users can view their own budget plans"
    ON budget_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget plans"
    ON budget_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget plans"
    ON budget_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget plans"
    ON budget_plans FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for budget_items (via budget_plans)
CREATE POLICY "Users can view budget items for their plans"
    ON budget_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM budget_plans bp
        WHERE bp.id = budget_items.budget_plan_id
        AND bp.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert budget items for their plans"
    ON budget_items FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM budget_plans bp
        WHERE bp.id = budget_items.budget_plan_id
        AND bp.user_id = auth.uid()
    ));

CREATE POLICY "Users can update budget items for their plans"
    ON budget_items FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM budget_plans bp
        WHERE bp.id = budget_items.budget_plan_id
        AND bp.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete budget items for their plans"
    ON budget_items FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM budget_plans bp
        WHERE bp.id = budget_items.budget_plan_id
        AND bp.user_id = auth.uid()
    ));

-- RLS Policies for insights
CREATE POLICY "Users can view their own insights"
    ON insights FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insights"
    ON insights FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
    ON insights FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for recommendations
CREATE POLICY "Users can view their own recommendations"
    ON recommendations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations"
    ON recommendations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
    ON recommendations FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for financial_audit_log
CREATE POLICY "Users can view their own audit logs"
    ON financial_audit_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
    ON financial_audit_log FOR INSERT
    WITH CHECK (auth.uid() = user_id); -- Users can insert their own audit logs (via API)

-- ============================================================
-- 9. FUNCTIONS & TRIGGERS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_user_survey_updated_at BEFORE UPDATE ON user_survey
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchant_mappings_updated_at BEFORE UPDATE ON merchant_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_rules_updated_at BEFORE UPDATE ON category_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_items_updated_at BEFORE UPDATE ON recurring_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_items_updated_at BEFORE UPDATE ON budget_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

