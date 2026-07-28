/**
 * Tests for the pure helpers behind the Billing screen
 * (`src/lib/billingQueries.ts`): the metrics query builder (with and
 * without `from`), row shaping for the breakdown tables and the daily
 * series, the empty-state predicate, and the single-request
 * `loadBilling` orchestration (empty ledger, error, all-time). No live
 * network: the API call is injected.
 */
import { describe, it, expect } from 'vitest';
import {
    billingBreakdownRows,
    buildBillingMetricsQuery,
    dailyToRows,
    formatCount,
    formatCurrencyAmount,
    isBillingEmpty,
    loadBilling,
    revenueByCurrencyRows,
    type AdminBillingMetrics,
} from '../lib/billingQueries';
import { rangeForKey, type ApiCall } from '../lib/analyticsQueries';

const NOW = new Date('2026-07-22T10:00:00.000Z');

/** A fully zeroed DTO, the pre-IAP empty shape the backend returns at 200. */
function emptyMetrics(): AdminBillingMetrics {
    return {
        totalEvents: 0,
        newSubscriptions: 0, trialStarts: 0, directPaidPurchases: 0, paidConversions: 0,
        renewals: 0, cancellations: 0, uncancellations: 0, expirations: 0,
        billingIssues: 0, productChanges: 0, transfers: 0,
        unresolvedEvents: 0, uniqueUsers: 0, revenueUsd: 0,
        byEventType: {}, byProductId: {}, byCountry: {}, byCancelReason: {},
        revenueByCurrency: {}, daily: [],
    };
}

describe('buildBillingMetricsQuery', () => {
    it('finite range: sets both from and to', () => {
        const q = buildBillingMetricsQuery(rangeForKey('7d', NOW));
        expect(q).toContain('/admin/billing/metrics?');
        expect(q).toContain('from=2026-07-16T00%3A00%3A00.000Z');
        expect(q).toContain('to=2026-07-22T10%3A00%3A00.000Z');
    });

    it('all-time: omits from entirely', () => {
        const q = buildBillingMetricsQuery(rangeForKey('all', NOW));
        expect(q).not.toContain('from=');
        expect(q).toContain('to=');
    });
});

describe('billingBreakdownRows', () => {
    it('orders by count desc, then key asc on ties', () => {
        expect(billingBreakdownRows({ RENEWAL: 5, INITIAL_PURCHASE: 5, CANCELLATION: 12 })).toEqual([
            { key: 'CANCELLATION', count: 12 },
            { key: 'INITIAL_PURCHASE', count: 5 },
            { key: 'RENEWAL', count: 5 },
        ]);
    });

    it('returns an empty list for an absent dictionary', () => {
        expect(billingBreakdownRows(undefined)).toEqual([]);
        expect(billingBreakdownRows({})).toEqual([]);
    });
});

describe('revenueByCurrencyRows', () => {
    it('orders by amount desc, then currency asc, never summing across currencies', () => {
        const rows = revenueByCurrencyRows({ EUR: 39.99, USD: 39.99, GBP: 120 });
        expect(rows).toEqual([
            { currency: 'GBP', amount: 120 },
            { currency: 'EUR', amount: 39.99 },
            { currency: 'USD', amount: 39.99 },
        ]);
    });

    it('returns an empty list for an absent dictionary', () => {
        expect(revenueByCurrencyRows(undefined)).toEqual([]);
        expect(revenueByCurrencyRows(null)).toEqual([]);
    });
});

describe('dailyToRows', () => {
    it('labels each UTC day and preserves the backend ascending order', () => {
        expect(dailyToRows([
            { date: '2026-07-20', count: 3 },
            { date: '2026-07-21', count: 7 },
        ])).toEqual([
            { label: '20 Jul', count: 3 },
            { label: '21 Jul', count: 7 },
        ]);
    });

    it('returns an empty list for an absent series', () => {
        expect(dailyToRows(undefined)).toEqual([]);
        expect(dailyToRows([])).toEqual([]);
    });
});

describe('isBillingEmpty', () => {
    it('true for a zeroed DTO and for null (pre-IAP / not loaded)', () => {
        expect(isBillingEmpty(emptyMetrics())).toBe(true);
        expect(isBillingEmpty(null)).toBe(true);
    });

    it('false once any event exists', () => {
        expect(isBillingEmpty({ ...emptyMetrics(), totalEvents: 1 })).toBe(false);
    });
});

describe('formatters', () => {
    it('formatCount stringifies whole numbers', () => {
        expect(formatCount(0)).toBe('0');
        expect(formatCount(42)).toBe('42');
    });

    it('formatCurrencyAmount fixes to 2 decimals', () => {
        expect(formatCurrencyAmount(39.9)).toBe('39.90');
        expect(formatCurrencyAmount(0)).toBe('0.00');
    });
});

describe('loadBilling (single-request orchestration with injected api)', () => {
    const okApi = (metrics: AdminBillingMetrics, seen?: { paths: string[]; signals: (AbortSignal | undefined)[] }): ApiCall =>
        async <T,>(path: string, options?: { signal?: AbortSignal }) => {
            seen?.paths.push(path);
            seen?.signals.push(options?.signal);
            return { data: metrics as unknown as T, error: null };
        };

    it('empty ledger: returns the zeroed DTO at the right path, no error', async () => {
        const seen = { paths: [] as string[], signals: [] as (AbortSignal | undefined)[] };
        const snap = await loadBilling(okApi(emptyMetrics(), seen), '7d', { now: NOW });

        expect(snap.error).toBeNull();
        expect(snap.metrics && isBillingEmpty(snap.metrics)).toBe(true);
        expect(seen.paths).toHaveLength(1);
        expect(seen.paths[0]).toContain('/admin/billing/metrics?');
    });

    it('propagates the abort signal to the request', async () => {
        const controller = new AbortController();
        const seen = { paths: [] as string[], signals: [] as (AbortSignal | undefined)[] };
        await loadBilling(okApi(emptyMetrics(), seen), '30d', { now: NOW, signal: controller.signal });
        expect(seen.signals[0]).toBe(controller.signal);
    });

    it('all-time: omits from in the request path', async () => {
        const seen = { paths: [] as string[], signals: [] as (AbortSignal | undefined)[] };
        await loadBilling(okApi(emptyMetrics(), seen), 'all', { now: NOW });
        expect(seen.paths[0]).not.toContain('from=');
    });

    it('surfaces an endpoint error without throwing', async () => {
        const api: ApiCall = async () => ({ data: null, error: 'HTTP 500' });
        const snap = await loadBilling(api, '7d', { now: NOW });
        expect(snap.error).toBe('HTTP 500');
        expect(snap.metrics).toBeNull();
    });

    it('never rejects: an api throw becomes an error snapshot', async () => {
        const api: ApiCall = async () => { throw new Error('boom'); };
        const snap = await loadBilling(api, '7d', { now: NOW });
        expect(snap.error).toBe('boom');
        expect(snap.metrics).toBeNull();
    });

    it('populated ledger: passes revenue and counts through untouched', async () => {
        const metrics: AdminBillingMetrics = {
            ...emptyMetrics(),
            totalEvents: 3, newSubscriptions: 2, trialStarts: 1, directPaidPurchases: 1,
            revenueUsd: 9.99,
            byEventType: { INITIAL_PURCHASE: 2, RENEWAL: 1 },
            revenueByCurrency: { USD: 9.99 },
            daily: [{ date: '2026-07-21', count: 3 }],
        };
        const snap = await loadBilling(okApi(metrics), '7d', { now: NOW });
        expect(isBillingEmpty(snap.metrics)).toBe(false);
        expect(snap.metrics?.revenueUsd).toBe(9.99);
        expect(billingBreakdownRows(snap.metrics?.byEventType)).toEqual([
            { key: 'INITIAL_PURCHASE', count: 2 },
            { key: 'RENEWAL', count: 1 },
        ]);
    });
});
