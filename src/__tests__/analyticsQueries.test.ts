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
    loadAnalytics,
    percentile,
    rangeBounds,
    safeDiv,
    type AdminChatTurn,
    type AdminPlanMetric,
    type AnalyticsPage,
    type ApiCall,
} from '../lib/analyticsQueries';

const NOW = new Date('2026-07-22T10:00:00.000Z');

describe('rangeBounds (anclado a medianoche UTC)', () => {
    it('from = 00:00Z de hace N-1 días; to = now', () => {
        expect(rangeBounds(7, NOW)).toEqual({
            from: '2026-07-16T00:00:00.000Z',
            to: '2026-07-22T10:00:00.000Z',
        });
        expect(rangeBounds(30, NOW).from).toBe('2026-06-23T00:00:00.000Z');
    });

    it('un rango de N días produce exactamente N buckets diarios y solo el último ("hoy") es parcial', () => {
        const days7 = listDaysUtc(rangeBounds(7, NOW));
        expect(days7).toHaveLength(7);
        expect(days7[0]).toBe('2026-07-16');
        expect(days7[6]).toBe('2026-07-22');
        expect(listDaysUtc(rangeBounds(30, NOW))).toHaveLength(30);
    });
});

describe('query builders (endpoints /admin/analytics/*)', () => {
    const range = rangeBounds(7, NOW);

    it('lista de chat turns: paginación + rango, ISO escapado por URLSearchParams', () => {
        const url = buildChatTurnsQuery(range, 200, 400);
        expect(url).toBe(
            '/admin/analytics/chat-turns?from=2026-07-16T00%3A00%3A00.000Z&to=2026-07-22T10%3A00%3A00.000Z&limit=200&offset=400',
        );
    });

    it('stats de chat turns: solo from/to', () => {
        expect(buildChatTurnsStatsQuery(range)).toBe(
            '/admin/analytics/chat-turns/stats?from=2026-07-16T00%3A00%3A00.000Z&to=2026-07-22T10%3A00%3A00.000Z',
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

        expect(res).toEqual({ items: [1, 2, 3], total: 3, truncated: false, aborted: false, error: null });
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
        expect(res).toEqual({ items: [], total: 0, truncated: false, aborted: false, error: null });
    });

    it('MAJOR-1: la señal abortada corta el loop entre páginas (ni un request más)', async () => {
        const controller = new AbortController();
        let calls = 0;
        const res = await fetchAllPages<number>(
            async (_limit, offset) => {
                calls++;
                // Simula el abort disparado mientras la primera página está en vuelo.
                controller.abort();
                return { data: page([offset], 100), error: null };
            },
            { pageLimit: 1, maxPages: 10, signal: controller.signal },
        );

        expect(calls).toBe(1);
        expect(res.aborted).toBe(true);
        expect(res.error).toBeNull();
        expect(res.truncated).toBe(true);
    });

    it('MINOR-3: dedupe por id en frontera de página, con offset avanzando por filas descargadas', async () => {
        const row = (id: string) => ({ id });
        const pages: { id: string }[][] = [
            [row('a'), row('b')],
            [row('b'), row('c')], // 'b' repetida: empate de CreatedAt en la frontera
        ];
        const offsets: number[] = [];
        const res = await fetchAllPages<{ id: string }>(
            async (_limit, offset) => {
                offsets.push(offset);
                return { data: { items: pages[offsets.length - 1], total: 4 }, error: null };
            },
            { pageLimit: 2, getId: (r) => r.id },
        );

        expect(res.items.map((r) => r.id)).toEqual(['a', 'b', 'c']);
        // El offset avanza por lo DESCARGADO (2, no 3 filas únicas): no se
        // repite la misma ventana del servidor.
        expect(offsets).toEqual([0, 2]);
        expect(res.truncated).toBe(false);
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

describe('loadAnalytics (orquestación con api inyectada)', () => {
    const chatTurn = (over: Partial<AdminChatTurn>): AdminChatTurn => ({
        id: 't1', createdAt: '2026-07-21T08:00:00Z', latencyMs: 500,
        aiProvider: 'gemini', model: 'gemini-3.1-flash-lite',
        ...over,
    } as AdminChatTurn);

    const planMetric: AdminPlanMetric = {
        id: 'm1', createdAt: '2026-07-21T09:00:00Z', generationSource: 'chat',
    } as AdminPlanMetric;

    const makeApi = (over?: { chatTurns?: Partial<AdminChatTurn>[] }): { api: ApiCall; seenSignals: (AbortSignal | undefined)[]; paths: string[] } => {
        const seenSignals: (AbortSignal | undefined)[] = [];
        const paths: string[] = [];
        const turns = (over?.chatTurns ?? [{}]).map(chatTurn);
        const api: ApiCall = async <T,>(path: string, options?: { signal?: AbortSignal }) => {
            seenSignals.push(options?.signal);
            paths.push(path);
            if (path.startsWith('/admin/analytics/chat-turns/stats')) {
                return { data: { totalTurns: turns.length, totalCostUsd: 0.01, errorRate: 0, avgSlotCompleteness: 2 } as unknown as T, error: null };
            }
            if (path.startsWith('/admin/analytics/chat-turns')) {
                return { data: { turns, total: turns.length, limit: 200, offset: 0 } as unknown as T, error: null };
            }
            if (path.startsWith('/admin/analytics/plan-metrics/stats')) {
                return { data: { totalPlans: 1, openRate: 1, followRate: 0, totalCostUsd: 0.001 } as unknown as T, error: null };
            }
            return { data: { metrics: [planMetric], total: 1, limit: 200, offset: 0 } as unknown as T, error: null };
        };
        return { api, seenSignals, paths };
    };

    it('MAJOR-1: propaga la MISMA señal a las 4 llamadas (stats + listas)', async () => {
        const controller = new AbortController();
        const { api, seenSignals, paths } = makeApi();

        const snapshot = await loadAnalytics(api, 7, { now: NOW, signal: controller.signal });

        expect(paths).toHaveLength(4);
        expect(seenSignals.every((s) => s === controller.signal)).toBe(true);
        expect(snapshot.error).toBeNull();
        expect(snapshot.aborted).toBe(false);
    });

    it('snapshot feliz: stats + agregados coherentes con el rango', async () => {
        const { api } = makeApi();
        const snapshot = await loadAnalytics(api, 7, { now: NOW });

        expect(snapshot.chatStats?.totalTurns).toBe(1);
        expect(snapshot.chatAggregate.turnsPerDay).toHaveLength(7);
        expect(snapshot.planAggregate.sources).toEqual(['chat']);
        expect(snapshot.truncated).toBe(false);
    });

    it('MINOR-4: un throw en la agregación (ISO inválido) resuelve en snapshot de error, nunca rechaza', async () => {
        const { api } = makeApi({ chatTurns: [{ createdAt: 'not-a-date' }] });

        const snapshot = await loadAnalytics(api, 7, { now: NOW });

        expect(snapshot.error).toBeTruthy();
        expect(snapshot.chatStats).toBeNull();
        expect(snapshot.chatAggregate.turnsPerDay.every((b) => b.total === 0)).toBe(true);
    });

    it('el error de un endpoint aflora en el snapshot sin tumbar el resto', async () => {
        const base = makeApi();
        const api: ApiCall = async <T,>(path: string, options?: { signal?: AbortSignal }) => {
            if (path.startsWith('/admin/analytics/plan-metrics/stats')) {
                return { data: null, error: 'HTTP 500' };
            }
            return base.api<T>(path, options);
        };

        const snapshot = await loadAnalytics(api, 7, { now: NOW });

        expect(snapshot.error).toBe('HTTP 500');
        expect(snapshot.planStats).toBeNull();
        expect(snapshot.chatStats?.totalTurns).toBe(1);
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
