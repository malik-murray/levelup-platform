'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { UserSurveyInput, RiskTolerance, IncomeStability, DebtPayoffStrategy } from '@/lib/financial-concierge/types';

export default function FinancialSurveyPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [step, setStep] = useState(1);
    const totalSteps = 4;

    const [formData, setFormData] = useState<UserSurveyInput>({
        // Goals
        goal_debt_payoff: false,
        goal_saving: false,
        goal_investing: false,
        goal_spend_control: false,
        goal_rebuild_credit: false,
        goal_buy_house: false,
        goal_buy_car: false,
        
        // Risk & situation
        risk_tolerance: 'moderate',
        income_stability: 'stable',
        household_size: 1,
        
        // Targets
        target_savings_amount: null,
        target_savings_timeline_months: null,
        
        // Debt
        debt_details: [],
        debt_payoff_strategy: null,
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Get session token from Supabase client
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !session) {
                console.error('No session found:', sessionError);
                setError('Please log in to complete the survey');
                setLoading(false);
                router.push('/login');
                return;
            }

            const response = await fetch('/api/financial-concierge/survey', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                let errorMessage = `Failed to save survey (${response.status})`;
                let errorData: any = {};
                
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        errorData = await response.json();
                        errorMessage = errorData.error || errorData.message || errorMessage;
                    } else {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    }
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    errorMessage = `Failed to save survey (${response.status} ${response.statusText})`;
                }
                
                console.error('Survey save failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorMessage,
                    data: errorData,
                    url: response.url,
                });
                throw new Error(errorMessage);
            }

            // Parse success response
            const result = await response.json();
            console.log('Survey saved successfully:', result);
            
            // Show success message
            setSuccess(true);
            setError(null);
            
            // Redirect after a brief delay to show success message
            setTimeout(() => {
                router.push('/finance/concierge');
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Check if user is authenticated
        const checkAuth = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                router.push('/login');
            }
        };
        checkAuth();
    }, [router]);

    const toggleGoal = (goal: keyof UserSurveyInput) => {
        setFormData(prev => ({
            ...prev,
            [goal]: !prev[goal],
        }));
    };

    return (
        <div className="mx-auto max-w-2xl px-4 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Financial Goals Survey</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Help us personalize your financial concierge experience
                </p>
                <div className="mt-4 flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                        <div
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${(step / totalSteps) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                        Step {step} of {totalSteps}
                    </span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Goals */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">What are your financial goals?</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Select all that apply
                        </p>
                        <div className="space-y-3">
                            {[
                                { key: 'goal_debt_payoff' as const, label: 'Pay off debt', icon: '💳' },
                                { key: 'goal_saving' as const, label: 'Save money', icon: '💰' },
                                { key: 'goal_investing' as const, label: 'Invest for growth', icon: '📈' },
                                { key: 'goal_spend_control' as const, label: 'Control spending', icon: '🎯' },
                                { key: 'goal_rebuild_credit' as const, label: 'Rebuild credit', icon: '🔧' },
                                { key: 'goal_buy_house' as const, label: 'Buy a house', icon: '🏠' },
                                { key: 'goal_buy_car' as const, label: 'Buy a car', icon: '🚗' },
                            ].map(({ key, label, icon }) => (
                                <label
                                    key={key}
                                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData[key] as boolean}
                                        onChange={() => toggleGoal(key)}
                                        className="w-5 h-5 text-amber-500"
                                    />
                                    <span className="text-2xl">{icon}</span>
                                    <span className="flex-1 font-medium">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Risk & Situation */}
                {step === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold">Financial Situation</h2>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Risk Tolerance
                            </label>
                            <div className="space-y-2">
                                {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map(risk => (
                                    <label key={risk} className="flex items-center gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                        <input
                                            type="radio"
                                            name="risk_tolerance"
                                            value={risk}
                                            checked={formData.risk_tolerance === risk}
                                            onChange={(e) => setFormData(prev => ({ ...prev, risk_tolerance: e.target.value as RiskTolerance }))}
                                            className="w-4 h-4 text-amber-500"
                                        />
                                        <span className="capitalize">{risk}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Income Stability
                            </label>
                            <div className="space-y-2">
                                {(['stable', 'variable', 'unstable'] as IncomeStability[]).map(stability => (
                                    <label key={stability} className="flex items-center gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                        <input
                                            type="radio"
                                            name="income_stability"
                                            value={stability}
                                            checked={formData.income_stability === stability}
                                            onChange={(e) => setFormData(prev => ({ ...prev, income_stability: e.target.value as IncomeStability }))}
                                            className="w-4 h-4 text-amber-500"
                                        />
                                        <span className="capitalize">{stability}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Household Size
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={formData.household_size || 1}
                                onChange={(e) => setFormData(prev => ({ ...prev, household_size: parseInt(e.target.value) || 1 }))}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Targets & Debt */}
                {step === 3 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold">Targets & Debt</h2>
                        
                        {formData.goal_saving && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Target Savings Amount ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.target_savings_amount || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, target_savings_amount: parseFloat(e.target.value) || null }))}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Timeline (months)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.target_savings_timeline_months || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, target_savings_timeline_months: parseInt(e.target.value) || null }))}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                                    />
                                </div>
                            </div>
                        )}

                        {formData.goal_debt_payoff && (
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Debt Payoff Strategy
                                </label>
                                <div className="space-y-2">
                                    {(['avalanche', 'snowball', 'minimum'] as DebtPayoffStrategy[]).map(strategy => (
                                        <label key={strategy} className="flex items-center gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                            <input
                                                type="radio"
                                                name="debt_payoff_strategy"
                                                value={strategy}
                                                checked={formData.debt_payoff_strategy === strategy}
                                                onChange={(e) => setFormData(prev => ({ ...prev, debt_payoff_strategy: e.target.value as DebtPayoffStrategy }))}
                                                className="w-4 h-4 text-amber-500"
                                            />
                                            <div>
                                                <span className="capitalize font-medium">{strategy}</span>
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    {strategy === 'avalanche' && 'Pay highest APR first'}
                                                    {strategy === 'snowball' && 'Pay smallest balance first'}
                                                    {strategy === 'minimum' && 'Pay minimums only'}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Review */}
                {step === 4 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Review Your Responses</h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <strong>Goals:</strong>{' '}
                                {[
                                    formData.goal_debt_payoff && 'Debt Payoff',
                                    formData.goal_saving && 'Saving',
                                    formData.goal_investing && 'Investing',
                                    formData.goal_spend_control && 'Spend Control',
                                    formData.goal_rebuild_credit && 'Rebuild Credit',
                                    formData.goal_buy_house && 'Buy House',
                                    formData.goal_buy_car && 'Buy Car',
                                ].filter(Boolean).join(', ') || 'None selected'}
                            </div>
                            <div>
                                <strong>Risk Tolerance:</strong> {formData.risk_tolerance}
                            </div>
                            <div>
                                <strong>Income Stability:</strong> {formData.income_stability}
                            </div>
                            <div>
                                <strong>Household Size:</strong> {formData.household_size}
                            </div>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                        <span className="text-lg">✓</span>
                        <span>Survey saved successfully! Redirecting to Concierge...</span>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-200">
                        {error}
                    </div>
                )}

                <div className="flex gap-3">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={() => setStep(step - 1)}
                            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        >
                            Previous
                        </button>
                    )}
                    {step < totalSteps ? (
                        <button
                            type="button"
                            onClick={() => setStep(step + 1)}
                            className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Complete Survey'}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

