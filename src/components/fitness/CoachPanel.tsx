'use client';

import { useMemo, useState } from 'react';
import AITrainerAvatar from './AITrainerAvatar';

type CoachPanelProps = {
    title?: string;
    howTo: string;
    focusCue: string;
    motivationCue: string;
};

export default function CoachPanel({
    title = 'AI Trainer',
    howTo,
    focusCue,
    motivationCue,
}: CoachPanelProps) {
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const fullCue = useMemo(
        () => `${howTo}. Focus cue: ${focusCue}. Motivation: ${motivationCue}.`,
        [focusCue, howTo, motivationCue]
    );

    const readAloud = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(fullCue);
        utterance.rate = 0.96;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    return (
        <section className="rounded-lg border border-amber-500/40 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <AITrainerAvatar size="md" />
                    <div>
                        <h3 className="text-sm font-semibold text-amber-300">{title}</h3>
                        <p className="text-xs text-slate-400">Live coaching cues for this workout</p>
                    </div>
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-300">
                    <input
                        type="checkbox"
                        checked={ttsEnabled}
                        onChange={(e) => setTtsEnabled(e.target.checked)}
                    />
                    Read aloud
                </label>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-200">
                <p><span className="font-semibold text-amber-200">How-to:</span> {howTo}</p>
                <p><span className="font-semibold text-amber-200">Focus:</span> {focusCue}</p>
                <p><span className="font-semibold text-amber-200">Motivation:</span> {motivationCue}</p>
            </div>
            {ttsEnabled && (
                <button
                    type="button"
                    onClick={readAloud}
                    className="mt-3 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
                >
                    {speaking ? 'Reading…' : 'Play cue'}
                </button>
            )}
        </section>
    );
}
