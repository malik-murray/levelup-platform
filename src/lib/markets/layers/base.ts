/**
 * Base Data Layer
 * Abstract class that all data layers extend
 */

import { DataLayer, LayerInput, LayerOutput, AnalysisMode } from '../types';

export abstract class BaseDataLayer implements DataLayer {
    abstract name: string;
    
    abstract analyze(input: LayerInput): Promise<LayerOutput>;
    
    abstract isApplicable(mode: AnalysisMode): boolean;
    
    /**
     * Helper to normalize score to 0-10 range
     */
    protected normalizeScore(score: number, min: number, max: number): number {
        if (max === min) return 5; // Neutral if no range
        const normalized = ((score - min) / (max - min)) * 10;
        return Math.max(0, Math.min(10, normalized));
    }
}

