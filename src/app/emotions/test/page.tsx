'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@auth/supabaseClient';

type Question = {
    id: string;
    question_type: 'multiple_choice' | 'scenario';
    question_text: string;
    scenario_description: string | null;
    options: Array<{ id: string; text: string; value: number }> | null;
    order_index: number;
    response?: {
        question_id: string;
        selected_option_id: string;
        selected_option_value: number;
    };
    reflection?: {
        question_id: string;
        reflection_text: string;
    };
};

export default function EmotionalTestPage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [testId, setTestId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [responses, setResponses] = useState<Map<string, { optionId: string; value: number }>>(new Map());
    const [reflections, setReflections] = useState<Map<string, string>>(new Map());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadTest();
    }, []);

    const loadTest = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = '/login';
                return;
            }

            const response = await fetch('/api/emotions/test', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || 'Failed to load test';
                const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
                const errorHint = errorData.hint ? `\n\n${errorData.hint}` : '';
                throw new Error(`${errorMessage}${errorDetails}${errorHint}`);
            }

            const data = await response.json();
            setTestId(data.testId);
            setQuestions(data.questions || []);

            // Load existing responses and reflections
            const responseMap = new Map<string, { optionId: string; value: number }>();
            const reflectionMap = new Map<string, string>();

            data.questions?.forEach((q: Question) => {
                if (q.response) {
                    responseMap.set(q.id, {
                        optionId: q.response.selected_option_id,
                        value: q.response.selected_option_value,
                    });
                }
                if (q.reflection) {
                    reflectionMap.set(q.id, q.reflection.reflection_text);
                }
            });

            setResponses(responseMap);
            setReflections(reflectionMap);
        } catch (err) {
            console.error('Error loading test:', err);
            setError(err instanceof Error ? err.message : 'Failed to load test');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = (questionId: string, optionId: string, value: number) => {
        setResponses(prev => {
            const newMap = new Map(prev);
            newMap.set(questionId, { optionId, value });
            return newMap;
        });
    };

    const handleReflectionChange = (questionId: string, text: string) => {
        setReflections(prev => {
            const newMap = new Map(prev);
            newMap.set(questionId, text);
            return newMap;
        });
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSaveProgress = async () => {
        try {
            setSubmitting(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !testId) return;

            const responseArray = Array.from(responses.entries()).map(([questionId, data]) => ({
                questionId,
                selectedOptionId: data.optionId,
                selectedOptionValue: data.value,
            }));

            const reflectionArray = Array.from(reflections.entries())
                .filter(([_, text]) => text.trim().length > 0)
                .map(([questionId, reflectionText]) => ({
                    questionId,
                    reflectionText: reflectionText.trim(),
                }));

            const response = await fetch('/api/emotions/test/submit', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    testId,
                    responses: responseArray,
                    reflections: reflectionArray,
                    markComplete: false,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save progress');
            }

            alert('Progress saved successfully!');
        } catch (err) {
            console.error('Error saving progress:', err);
            setError(err instanceof Error ? err.message : 'Failed to save progress');
        } finally {
            setSubmitting(false);
        }
    };

    const handleComplete = async () => {
        // Validate that all questions are answered
        const multipleChoiceQuestions = questions.filter(q => q.question_type === 'multiple_choice');
        const scenarioQuestions = questions.filter(q => q.question_type === 'scenario');

        const unansweredMultipleChoice = multipleChoiceQuestions.filter(q => !responses.has(q.id));
        const unansweredReflections = scenarioQuestions.filter(q => {
            const reflection = reflections.get(q.id);
            return !reflection || reflection.trim().length === 0;
        });

        if (unansweredMultipleChoice.length > 0) {
            alert(`Please answer all multiple-choice questions. ${unansweredMultipleChoice.length} remaining.`);
            return;
        }

        if (unansweredReflections.length > 0) {
            const proceed = confirm(
                `You haven't provided reflections for ${unansweredReflections.length} scenario(s). ` +
                'Would you like to complete the test anyway? You can always add reflections later.'
            );
            if (!proceed) return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !testId) return;

            const responseArray = Array.from(responses.entries()).map(([questionId, data]) => ({
                questionId,
                selectedOptionId: data.optionId,
                selectedOptionValue: data.value,
            }));

            const reflectionArray = Array.from(reflections.entries())
                .filter(([_, text]) => text.trim().length > 0)
                .map(([questionId, reflectionText]) => ({
                    questionId,
                    reflectionText: reflectionText.trim(),
                }));

            // Save responses and mark as complete
            const submitResponse = await fetch('/api/emotions/test/submit', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    testId,
                    responses: responseArray,
                    reflections: reflectionArray,
                    markComplete: true,
                }),
            });

            if (!submitResponse.ok) {
                const errorData = await submitResponse.json();
                throw new Error(errorData.error || 'Failed to complete test');
            }

            // Generate summary
            const summaryResponse = await fetch('/api/emotions/test/generate-summary', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ testId }),
            });

            if (!summaryResponse.ok) {
                const errorData = await summaryResponse.json();
                throw new Error(errorData.error || 'Failed to generate summary');
            }

            // Redirect to results page
            window.location.href = `/emotions/test/results?testId=${testId}`;
        } catch (err) {
            console.error('Error completing test:', err);
            setError(err instanceof Error ? err.message : 'Failed to complete test');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-slate-400">Loading test...</p>
                </div>
            </main>
        );
    }

    if (error && questions.length === 0) {
        return (
            <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={loadTest}
                            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const isMultipleChoice = currentQuestion?.question_type === 'multiple_choice';
    const currentResponse = currentQuestion ? responses.get(currentQuestion.id) : undefined;
    const currentReflection = currentQuestion ? reflections.get(currentQuestion.id) || '' : '';

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/emotions" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Emotional Assessment</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Discover your emotional patterns</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/emotions"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Back
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-6 py-6">
                {error && (
                    <div className="mb-4 rounded-md border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Progress Bar */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">
                            Question {currentQuestionIndex + 1} of {questions.length}
                        </span>
                        <span className="text-sm text-slate-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800">
                        <div
                            className="h-2 rounded-full bg-amber-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Question */}
                {currentQuestion && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4 text-amber-400">
                            {isMultipleChoice ? 'Multiple Choice' : 'Scenario Reflection'}
                        </h2>
                        <p className="text-base mb-4 text-slate-200">{currentQuestion.question_text}</p>

                        {currentQuestion.scenario_description && (
                            <div className="mb-6 p-4 rounded-md border border-slate-700 bg-slate-900">
                                <p className="text-sm text-slate-300 italic">{currentQuestion.scenario_description}</p>
                            </div>
                        )}

                        {isMultipleChoice && currentQuestion.options && (
                            <div className="space-y-3">
                                {currentQuestion.options.map(option => (
                                    <label
                                        key={option.id}
                                        className={`flex items-start gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                                            currentResponse?.optionId === option.id
                                                ? 'border-amber-500 bg-amber-950/20'
                                                : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name={`question-${currentQuestion.id}`}
                                            value={option.id}
                                            checked={currentResponse?.optionId === option.id}
                                            onChange={() => handleAnswerSelect(currentQuestion.id, option.id, option.value)}
                                            className="mt-1"
                                        />
                                        <span className="text-sm text-slate-200 flex-1">{option.text}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {!isMultipleChoice && (
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Share your thoughts and feelings about this scenario:
                                </label>
                                <textarea
                                    value={currentReflection}
                                    onChange={e => handleReflectionChange(currentQuestion.id, e.target.value)}
                                    placeholder="Reflect on how you would feel in this situation and why. Be honest and detailed..."
                                    className="w-full h-48 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePrevious}
                        disabled={currentQuestionIndex === 0}
                        className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Previous
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveProgress}
                            disabled={submitting}
                            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? 'Saving...' : 'Save Progress'}
                        </button>

                        {currentQuestionIndex < questions.length - 1 ? (
                            <button
                                onClick={handleNext}
                                className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={submitting}
                                className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting ? 'Generating Summary...' : 'Complete Test'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

