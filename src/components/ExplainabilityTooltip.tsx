'use client';

import { ReactNode, useState } from 'react';

interface ExplainabilityTooltipProps {
    explanation: string;
    confidence?: number;
    method?: string;
    children: ReactNode;
    className?: string;
}

export function ExplainabilityTooltip({
    explanation,
    confidence,
    method,
    children,
    className = '',
}: ExplainabilityTooltipProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                className="cursor-help"
            >
                {children}
            </div>
            {showTooltip && (
                <div className="absolute z-50 w-64 p-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                    <div className="font-semibold mb-1">Why this category?</div>
                    <p className="mb-2">{explanation}</p>
                    {confidence !== undefined && (
                        <div className="text-xs opacity-75">
                            Confidence: {(confidence * 100).toFixed(0)}%
                        </div>
                    )}
                    {method && (
                        <div className="text-xs opacity-75">Method: {method}</div>
                    )}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <div className="border-4 border-transparent border-t-slate-900 dark:border-t-slate-100" />
                    </div>
                </div>
            )}
        </div>
    );
}

interface RecommendationTooltipProps {
    reason: string;
    linkedGoals?: string[];
    children: ReactNode;
    className?: string;
}

export function RecommendationTooltip({
    reason,
    linkedGoals,
    children,
    className = '',
}: RecommendationTooltipProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                className="cursor-help"
            >
                {children}
            </div>
            {showTooltip && (
                <div className="absolute z-50 w-72 p-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                    <div className="font-semibold mb-1">Why this recommendation?</div>
                    <p className="mb-2">{reason}</p>
                    {linkedGoals && linkedGoals.length > 0 && (
                        <div className="text-xs opacity-75">
                            Based on your goals: {linkedGoals.join(', ')}
                        </div>
                    )}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <div className="border-4 border-transparent border-t-slate-900 dark:border-t-slate-100" />
                    </div>
                </div>
            )}
        </div>
    );
}



