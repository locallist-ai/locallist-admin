/**
 * Tests de los helpers puros de la pantalla Analytics
 * (`src/lib/analyticsQueries.ts`): bounds del rango, builders de query
 * contra los endpoints admin de analítica, loop de acumulación de
 * páginas, percentiles, bucketing por día UTC y formatters.
 */
import { describe, it, expect } from 'vitest';
import {
    aggregateChatTurns,
    aggregatePlanMetrics,
    ANALYTICS_PAGE_LIMIT,
    bucketByDay,
    buildChatTurnsQuery,
    buildChatTurnsStatsQuery,
    buildPlanMetricsQuery,
    buildPlanMetricsStatsQuery,
    countByKey,
    dayKeyUtc,
    fetchAllPages,
    formatDayLabel,
    formatMs,
    formatPct,
    formatUsd,
    listDaysUtc,
    percentile,
    rangeBounds,
    safeDiv,
    type AdminChatTurn,
    type AdminPlanMetric,
    type AnalyticsPage,
} from '../lib/analyticsQueries';

const NOW = new Date('2026-07-22T10:00:00.000Z');

describe('rangeBounds', () => {
    it('resta exactamente 7 o 30 días respecto a `now`', () => {
        expect(rangeBounds(7, NOW)).toEqual({
            from: '2026-07-15T10:00:00.000Z',
            to: '2026-07-22T10:00:00.000Z',
        });
        expect(rangeBounds(30, NOW).from).toBe('2026-06-22T10:00:00.000Z');
    });
});

describe('query builders (endpoints /admin/analytics/*)', () => {
    const range = rangeBounds(7, NOW);

    it('lista de chat turns: paginación + rango, ISO escapado por URLSearchParams', () => {
        const url = buildChatTurnsQuery(range, 200, 400);
        expect(url).toBe(
            '/admin/analytics/chat-turns?from=2026-07-15T10%3A00%3A00.000Z&to=2026-07-22T10%3A00%3A00.000Z&limit=200&offset=400',
        );
    });

    it('stats de chat turns: solo from/to', () => {
        expect(buildChatTurnsStatsQuery(range)).toBe(
            '/admin/analytics/chat-turns/stats?from=2026-07-15T10%3A00%3A00.000Z&to=2026-07-22T10%3A00%3A00.000Z',
        );
    });

    it('lista y stats de plan metrics apuntan a su ruta', () => {
        expect(buildPlanMetricsQuery(range, 50, 0)).toContain('/admin/analytics/plan-metrics?from=');
        expect(buildPlanMetricsQuery(range, 50, 0)).toContain('limit=50');
        expect(buildPlanMetricsQuery(range, 50, 0)).toContain('offset=0');
        expect(buildPlanMetricsStatsQuery(range)).toContain('/admin/analytics/plan-metrics/stats?from=');
    });

    it('el límite por página respeta el clamp del backend (máx 200)', () => {
        expect(ANALYTICS_PAGE_LIMIT).toBeLessThanOrEqual(200);
    });
});

describe('fetchAllPages', () => {
    const page = (items: number[], total: number): AnalyticsPage<number> => ({ items, total });

    it('una sola página cuando total <= limit', async () => {
        const calls: [number, number][] = [];
        const res = await fetchAllPages<number>(async (limit, offset) => {
            calls.push([limit, offset]);
            return { data: page([1, 2, 3], 3), error: null };
        }, { pageLimit: 5 });

        expect(res).toEqual({ items: [1, 2, 3], total: 3, truncated: false, error: null });
        expect(calls).toEqual([[5, 0]]);
    });

    it('acumula páginas avanzando el offset hasta cubrir el total', async () => {
        const calls: number[] = [];
        const res = await fetchAllPages<number>(async (limit, offset) => {
            calls.push(offset);
            return { data: page([offset + 1, offset + 2], 5), error: null };
        }, { pageLimit: 2 });

        expect(res.items).toEqual([1, 2, 3, 4, 5, 6]);
        expect(calls).toEqual([0, 2, 4]);
        expect(res.truncated).toBe(false);
    });

    it('una página corta termina el loop aunque no alcance el total (drift)', async () => {
        const res = await fetchAllPages<number>(
            async (_limit, offset) => (offset === 0
                ? { data: page([1, 2], 10), error: null }
                : { data: page([3], 10), error: null }),
            { pageLimit: 2 },
        );
        expect(res.items).toEqual([1, 2, 3]);
        expect(res.truncated).toBe(false);
    });

    it('corta en maxPages y marca truncated', async () => {
        const res = await fetchAllPages<number>(
            async (_limit, offset) => ({ data: page([offset], 100), error: null }),
            { pageLimit: 1, maxPages: 3 },
        );
        expect(res.items).toEqual([0, 1, 2]);
        expect(res.truncated).toBe(true);
        expect(res.error).toBeNull();
    });

    it('un error devuelve lo acumulado + el mensaje', async () => {
        const res = await fetchAllPages<number>(
            async (_limit, offset) => (offset === 0
                ? { data: page([1, 2], 4), error: null }
                : { data: null, error: 'HTTP 500' }),
            { pageLimit: 2 },
        );
        expect(res.items).toEqual([1, 2]);
        expect(res.error).toBe('HTTP 500');
        expect(res.truncated).toBe(true);
    });

    it('rango vacío: total 0, sin truncar', async () => {
        const res = await fetchAllPages<number>(async () => ({ data: page([], 0), error: null }));
        expect(res).toEqual({ items: [], total: 0, truncated: false, error: null });
    });
});

describe('percentile (nearest-rank)', () => {
    it('muestra vacía → null', () => {
        expect(percentile([], 50)).toBeNull();
    });

    it('p50/p95 sobre muestra desordenada, sin mutarla', () => {
        const values = [900, 100, 300, 500, 700];
        expect(percentile(values, 50)).toBe(500);
        expect(percentile(values, 95)).toBe(900);
        expect(values).toEqual([900, 100, 300, 500, 700]);
    });

    it('un solo valor responde a cualquier p', () => {
        expect(percentile([42], 50)).toBe(42);
        expect(percentile([42], 95)).toBe(42);
    });
});

describe('bucketing por día UTC', () => {
    const range = { from: '2026-07-20T06:00:00.000Z', to: '2026-07-22T10:00:00.000Z' };

    it('dayKeyUtc normaliza offsets no-UTC al día UTC', () => {
        expect(dayKeyUtc('2026-07-22T01:30:00+03:00')).toBe('2026-07-21');
        expect(dayKeyUtc('2026-07-22T23:30:00-02:00')).toBe('2026-07-23');
    });

    it('listDaysUtc cubre el rango inclusive, en orden', () => {
        expect(listDaysUtc(range)).toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
    });

    it('rellena con cero los días sin datos y descarta items fuera de rango', () => {
        const items = [
            { at: '2026-07-20T08:00:00Z' },
            { at: '2026-07-20T09:00:00Z' },
            { at: '2026-07-22T01:00:00Z' },
            { at: '2026-07-01T01:00:00Z' }, // fuera de rango
        ];
        expect(bucketByDay(items, range, (i) => i.at).map((b) => [b.day, b.total])).toEqual([
            ['2026-07-20', 2],
            ['2026-07-21', 0],
            ['2026-07-22', 1],
        ]);
    });

    it('con extractor de serie, desglosa counts por clave', () => {
        const items = [
            { at: '2026-07-20T08:00:00Z', source: 'chat' },
            { at: '2026-07-20T09:00:00Z', source: 'wizard' },
            { at: '2026-07-20T10:00:00Z', source: 'chat' },
        ];
        const [first] = bucketByDay(items, range, (i) => i.at, (i) => i.source);
        expect(first.total).toBe(3);
        expect(first.counts).toEqual({ chat: 2, wizard: 1 });
    });
});

describe('countByKey', () => {
    it('ordena por count desc y desempata alfabéticamente; share suma 1', () => {
        const mix = countByKey(
            ['b', 'a', 'b', 'c', 'a', 'b'].map((k) => ({ k })),
            (i) => i.k,
        );
        expect(mix.map((m) => m.key)).toEqual(['b', 'a', 'c']);
        expect(mix.map((m) => m.count)).toEqual([3, 2, 1]);
        expect(mix.reduce((sum, m) => sum + m.share, 0)).toBeCloseTo(1);
    });

    it('lista vacía → mix vacío', () => {
        expect(countByKey([], () => 'x')).toEqual([]);
    });
});

describe('agregados de bloque', () => {
    const range = { from: '2026-07-21T00:00:00.000Z', to: '2026-07-22T10:00:00.000Z' };

    const turn = (over: Partial<AdminChatTurn>): AdminChatTurn => ({
        id: '1', createdAt: '2026-07-21T08:00:00Z', sessionId: null, userId: null,
        turnIndex: 0, aiProvider: 'gemini', model: 'gemini-3.1-flash-lite', promptVersion: 'v1',
        promptChars: 100, finishReason: 'STOP', latencyMs: 500, inputTokens: 10, outputTokens: 20,
        thinkingTokens: 0, totalTokens: 30, costUsd: 0.0004, geminiStatus: 200,
        errorCode: null, errorMessage: null, slotCompleteness: 3,
        ...over,
    });

    it('aggregateChatTurns: serie diaria, percentiles y mix provider · model', () => {
        const agg = aggregateChatTurns([
            turn({ latencyMs: 200 }),
            turn({ latencyMs: 800, createdAt: '2026-07-22T09:00:00Z' }),
            turn({ latencyMs: 400, aiProvider: 'openai', model: 'gpt-5-nano' }),
        ], range);

        expect(agg.turnsPerDay.map((b) => b.total)).toEqual([2, 1]);
        expect(agg.latencyP50).toBe(400);
        expect(agg.latencyP95).toBe(800);
        expect(agg.providerModelMix.map((m) => m.key)).toEqual([
            'gemini · gemini-3.1-flash-lite',
            'openai · gpt-5-nano',
        ]);
    });

    it('aggregateChatTurns sin datos: percentiles null, series a cero', () => {
        const agg = aggregateChatTurns([], range);
        expect(agg.latencyP50).toBeNull();
        expect(agg.latencyP95).toBeNull();
        expect(agg.turnsPerDay.every((b) => b.total === 0)).toBe(true);
        expect(agg.providerModelMix).toEqual([]);
    });

    it('aggregatePlanMetrics: sources ordenados alfabéticamente (orden estable de color)', () => {
        const metric = (over: Partial<AdminPlanMetric>): AdminPlanMetric => ({
            id: '1', createdAt: '2026-07-21T08:00:00Z', planId: 'p1', planName: null, planCity: null,
            generationSource: 'chat', signalsFilled: 4, numDays: 2, numStops: 6, numCategories: 3,
            groupType: null, budget: null, latencyMs: 900, costUsd: 0.001,
            wasOpened: true, openedAt: null, wasFollowed: false, followedAt: null,
            editedCount: 0, regenerated: false,
            ...over,
        });
        const agg = aggregatePlanMetrics([
            metric({ generationSource: 'wizard' }),
            metric({}),
            metric({}),
        ], range);

        expect(agg.sources).toEqual(['chat', 'wizard']);
        expect(agg.sourceMix[0]).toEqual({ key: 'chat', count: 2, share: 2 / 3 });
        expect(agg.plansPerDayBySource[0].counts).toEqual({ chat: 2, wizard: 1 });
    });
});

describe('safeDiv y formatters', () => {
    it('safeDiv protege el denominador no positivo', () => {
        expect(safeDiv(10, 4)).toBe(2.5);
        expect(safeDiv(10, 0)).toBeNull();
    });

    it('formatUsd conserva 4 decimales bajo el céntimo', () => {
        expect(formatUsd(0.0004)).toBe('$0.0004');
        expect(formatUsd(0.1234)).toBe('$0.12');
        expect(formatUsd(12.5)).toBe('$12.50');
        expect(formatUsd(0)).toBe('$0.00');
    });

    it('formatPct redondea a 1 decimal y omite el .0', () => {
        expect(formatPct(0.435)).toBe('43.5%');
        expect(formatPct(0.5)).toBe('50%');
        expect(formatPct(0)).toBe('0%');
    });

    it('formatMs pasa a segundos desde 1000ms', () => {
        expect(formatMs(850)).toBe('850ms');
        expect(formatMs(1250)).toBe('1.3s');
    });

    it('formatDayLabel: día + mes corto', () => {
        expect(formatDayLabel('2026-07-22')).toBe('22 Jul');
        expect(formatDayLabel('2026-01-05')).toBe('5 Jan');
    });
});
