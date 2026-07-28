import { describe, it, expect } from 'vitest';
import {
    breakdownToRows,
    sortCityStats,
    type AdminPlanMetricsByCity,
} from '../lib/analyticsQueries';

describe('breakdownToRows (finishReason / errorCode distributions)', () => {
    it('orders by count desc, then key asc on ties', () => {
        const rows = breakdownToRows({ stop: 5, length: 5, safety: 12, other: 1 });
        expect(rows).toEqual([
            { key: 'safety', count: 12 },
            { key: 'length', count: 5 }, // tie with `stop` -> alphabetical
            { key: 'stop', count: 5 },
            { key: 'other', count: 1 },
        ]);
    });

    it('returns an empty list for an absent breakdown (WhenWritingNull)', () => {
        expect(breakdownToRows(undefined)).toEqual([]);
        expect(breakdownToRows(null)).toEqual([]);
        expect(breakdownToRows({})).toEqual([]);
    });

    it('keeps zero-count codes if the backend ever reports them', () => {
        expect(breakdownToRows({ a: 0, b: 3 })).toEqual([
            { key: 'b', count: 3 },
            { key: 'a', count: 0 },
        ]);
    });
});

describe('sortCityStats (per-city plan quality)', () => {
    const cities: AdminPlanMetricsByCity[] = [
        { city: 'Barcelona', count: 4, openRate: 0.5, followRate: 0.25 },
        { city: 'Miami', count: 9, openRate: 0.8, followRate: 0.4 },
        { city: 'Austin', count: 4, openRate: 0.1, followRate: 0.0 },
    ];

    it('orders by plan count desc, then city name asc', () => {
        expect(sortCityStats(cities).map((c) => c.city)).toEqual(['Miami', 'Austin', 'Barcelona']);
    });

    it('preserves the per-city rates for display', () => {
        const top = sortCityStats(cities)[0];
        expect(top).toMatchObject({ city: 'Miami', count: 9, openRate: 0.8, followRate: 0.4 });
    });

    it('does not mutate the input array', () => {
        const original = cities.map((c) => c.city);
        sortCityStats(cities);
        expect(cities.map((c) => c.city)).toEqual(original);
    });

    it('returns an empty list when byCity is absent', () => {
        expect(sortCityStats(undefined)).toEqual([]);
        expect(sortCityStats(null)).toEqual([]);
    });
});
