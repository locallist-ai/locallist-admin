import { describe, it, expect } from 'vitest';
import en from '../lib/i18n/en';
import es from '../lib/i18n/es';
import { BILLING_STAT_METRICS, BILLING_BREAKDOWN_METRICS, billingLegendKey } from '../lib/billingLegend';

/** Resolve a dotted i18n path (e.g. 'billing.legend.revenueUsd') to its string. */
function resolve(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, seg) => {
        if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[seg];
        return undefined;
    }, obj);
}

const ALL_METRICS = [...BILLING_STAT_METRICS, ...BILLING_BREAKDOWN_METRICS];

describe('billing legend coverage', () => {
    it('every billing metric maps to a legend key present in EN and ES', () => {
        for (const metric of ALL_METRICS) {
            const key = billingLegendKey(metric);
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

    it('every stat metric has a card label present in EN and ES', () => {
        for (const metric of BILLING_STAT_METRICS) {
            const key = `billing.cards.${metric}`;
            expect(typeof resolve(en, key), `EN missing card label ${key}`).toBe('string');
            expect(typeof resolve(es, key), `ES missing card label ${key}`).toBe('string');
        }
    });

    it('covers exactly the metrics rendered by the screen (no orphans)', () => {
        // Locks the metric set: adding a tile without a legend fails here.
        expect(BILLING_STAT_METRICS).toEqual([
            'totalEvents', 'uniqueUsers', 'unresolvedEvents', 'revenueUsd',
            'newSubscriptions', 'trialStarts', 'directPaidPurchases', 'paidConversions',
            'renewals', 'uncancellations',
            'cancellations', 'expirations', 'billingIssues', 'productChanges', 'transfers',
        ]);
        expect(BILLING_BREAKDOWN_METRICS).toEqual([
            'byEventType', 'byProductId', 'byCountry', 'byCancelReason', 'revenueByCurrency', 'daily',
        ]);
    });
});
