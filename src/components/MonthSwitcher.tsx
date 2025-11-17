"use client";

import { useState } from "react";
import { format, addMonths, subMonths } from "date-fns";

interface MonthSwitcherProps {
    currentMonth: Date;
    onMonthChange: (newMonth: Date) => void;
}

export default function MonthSwitcher({ currentMonth, onMonthChange }: MonthSwitcherProps) {
    const handlePrev = () => {
        const newDate = subMonths(currentMonth, 1);
        onMonthChange(newDate);
    };

    const handleNext = () => {
        const newDate = addMonths(currentMonth, 1);
        onMonthChange(newDate);
    };

    return (
        <div className="flex items-center justify-between w-full max-w-md mx-auto mt-4 mb-6 px-4">
            <button
                onClick={handlePrev}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white"
            >
                ◀
            </button>

            <h2 className="text-xl font-semibold text-white">
                {format(currentMonth, "MMMM yyyy")}
            </h2>

            <button
                onClick={handleNext}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white"
            >
                ▶
            </button>
        </div>
    );
}
