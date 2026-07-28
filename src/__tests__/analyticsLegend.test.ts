import { describe, it, expect } from 'vitest';
import en from '../lib/i18n/en';
import es from '../lib/i18n/es';
import { CHAT_METRICS, PLAN_METRICS, legendKey } from '../lib/analyticsLegend';

/** Resolve a dotted i18n path (e.g. 'analytics.legend.turns') to its string. */
function resolve(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, seg) => {
        if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[seg];
        return undefined;
    }, obj);
}

const ALL_METRICS = [...CHAT_METRICS, ...PLAN_METRICS];

describe('analytics legend coverage', () => {
    it('every dashboard metric maps to a legend key present in EN and ES', () => {
        for (const metric of ALL_METRICS) {
            const key = legendKey(metric);
            const enVal = resolve(en, key);
            const esVal = resolve(es, key);
            expect(typeof enVal, `EN missing legend for ${metric} (${key})`).toBe('string');
            expect(typeof esVal, `ES missing legend for ${metric} (${key})`).toBe('string');
            expect((enVal as string).length).toBeGreaterThan(10);
            expect((esVal as string).length).toBeGreaterThan(10);
            // Legend copy must actually be translated (not the EN string).
            expect(esVal, `legend for ${metric} not translated`).not.toBe(enVal);
        }
    });

    it('covers exactly the metrics rendered by the screen (no orphans)', () => {
        // Locks the metric set: adding a tile without a legend fails here.
        expect(CHAT_METRICS).toEqual([
            'turns', 'cost', 'latency', 'errorRate', 'slotCompleteness',
            'turnsPerPeriod', 'providerModel', 'finishReasons', 'errorCodes',
        ]);
        expect(PLAN_METRICS).toEqual([
            'plansGenerated', 'avgCost', 'opened', 'followed', 'plansBySource', 'byCity',
        ]);
    });

    it('the a11y legend label carries the {{metric}} placeholder in both languages', () => {
        expect(resolve(en, 'analytics.legend.a11y')).toContain('{{metric}}');
        expect(resolve(es, 'analytics.legend.a11y')).toContain('{{metric}}');
    });
});
