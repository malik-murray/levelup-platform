'use client';

import { useEffect, useState, useRef } from 'react';

type Quote = {
    text: string;
    author: string;
};

const QUOTES: Quote[] = [
    {
        text: 'Do not save what is left after spending; instead spend what is left after saving.',
        author: 'Warren Buffett',
    },
    {
        text: 'A budget is telling your money where to go instead of wondering where it went.',
        author: 'John C. Maxwell (popularized in personal finance by Dave Ramsey)',
    },
    {
        text: 'You must gain control over your money or the lack of it will forever control you.',
        author: 'Dave Ramsey',
    },
    {
        text: 'Saving is the gap between your ego and your income.',
        author: 'Morgan Housel, The Psychology of Money',
    },
    {
        text: 'Spending money to show people how much money you have is the fastest way to have less money.',
        author: 'Morgan Housel',
    },
    {
        text: 'We have to develop a healthy, honest relationship with our money. And we have to see this relationship as a reflection of our relationship with ourselves.',
        author: 'Suze Orman',
    },
    {
        text: 'Money is a living entity, and it responds to energy exactly the same way you do. It is drawn to those who welcome it, those who respect it.',
        author: 'Suze Orman',
    },
    {
        text: 'You are the one behind the earthly power of your money, that you always have been and always will be.',
        author: 'Suze Orman',
    },
    {
        text: 'The most important part of every plan is planning on your plan not going according to plan.',
        author: 'Morgan Housel',
    },
    {
        text: 'Investing should be more like watching paint dry or watching grass grow. If you want excitement, take $800 and go to Las Vegas.',
        author: 'Paul Samuelson',
    },
    {
        text: 'A simple rule dictates my buying: Be fearful when others are greedy, and be greedy when others are fearful.',
        author: 'Warren Buffett',
    },
    {
        text: 'Every untracked dollar is a decision you gave away.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'The moment you start measuring your money, you start multiplying it.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'A clear plan for your money beats a high income with no plan.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'Wealth is built in boring moments—showing up to your budget again and again.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'Your future family will thank you for every smart money choice you make today.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'If you want your money to feel peaceful, give every dollar a job.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'Cash flow is your financial heartbeat—monitor it, protect it, strengthen it.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'Treat your money like a business and your life starts running like one.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: "You don't need perfection with money, you need a system you actually follow.",
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'Small, consistent money decisions compound faster than big, inconsistent ones.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: "Budgets don't limit your life; they fund the life you really want.",
        author: 'LevelUp Financial Principle',
    },
    {
        text: "Ignoring your money is still a decision—it's just the most expensive one.",
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'Clarity with your numbers gives you confidence with your choices.',
        author: 'LevelUp Financial Principle',
    },
    {
        text: 'When couples share a plan for their money, they share a vision for their future.',
        author: 'LevelUp Financial Principle',
    },
];

export function MoneyQuotesCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-rotate every 7 seconds
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % QUOTES.length);
        }, 7000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Reset interval when manually changing quote
    const goToQuote = (index: number) => {
        setActiveIndex(index);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % QUOTES.length);
        }, 7000);
    };

    const goToPrevious = () => {
        goToQuote((activeIndex - 1 + QUOTES.length) % QUOTES.length);
    };

    const goToNext = () => {
        goToQuote((activeIndex + 1) % QUOTES.length);
    };

    // Touch handlers for swipe
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            goToNext();
        }
        if (isRightSwipe) {
            goToPrevious();
        }
    };

    const currentQuote = QUOTES[activeIndex];

    return (
        <div
            className="relative w-full"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Quote content */}
            <div className="relative px-2 py-1">
                <div className="flex items-start gap-2">
                    <span className="text-amber-400 text-xl font-serif leading-none mt-1">
                        "
                    </span>
                    <div className="flex-1">
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed dark:text-slate-300 light:text-slate-700">
                            {currentQuote.text}
                        </p>
                        <p className="mt-2 text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 light:text-slate-500 italic">
                            — {currentQuote.author}
                        </p>
                    </div>
                    <span className="text-amber-400 text-xl font-serif leading-none mt-auto mb-0">
                        "
                    </span>
                </div>
            </div>

            {/* Navigation controls */}
            <div className="mt-3 flex items-center justify-center gap-3">
                {/* Previous button */}
                <button
                    onClick={goToPrevious}
                    className="rounded-full border border-slate-700 bg-slate-900/50 p-1.5 text-slate-400 transition-all hover:border-amber-500/50 hover:bg-slate-800 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-900/50 light:border-slate-300 light:bg-white/50 light:hover:border-amber-500/50 light:hover:bg-slate-100"
                    aria-label="Previous quote"
                >
                    <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                </button>

                {/* Dots indicator */}
                <div className="flex gap-1.5">
                    {QUOTES.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToQuote(index)}
                            className={`h-1.5 rounded-full transition-all ${
                                index === activeIndex
                                    ? 'w-6 bg-amber-400'
                                    : 'w-1.5 bg-slate-600 dark:bg-slate-600 light:bg-slate-300 hover:bg-slate-500'
                            }`}
                            aria-label={`Go to quote ${index + 1}`}
                        />
                    ))}
                </div>

                {/* Next button */}
                <button
                    onClick={goToNext}
                    className="rounded-full border border-slate-700 bg-slate-900/50 p-1.5 text-slate-400 transition-all hover:border-amber-500/50 hover:bg-slate-800 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-900/50 light:border-slate-300 light:bg-white/50 light:hover:border-amber-500/50 light:hover:bg-slate-100"
                    aria-label="Next quote"
                >
                    <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}

