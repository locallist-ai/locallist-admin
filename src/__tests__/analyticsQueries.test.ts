/**
 * Tests de los helpers puros de la pantalla Analytics
 * (`src/lib/analyticsQueries.ts`): bounds del rango (incl. all-time y 1
 * año), builders de query contra los endpoints admin de analítica (con
 * y sin `from`), loop de acumulación de páginas, percentiles, bucketing
 * por periodo (día/semana/mes), inicio de serie all-time desde la
 * muestra, y formatters.
 */
import { describe, it, expect } from 'vitest';
import {
    aggregateChatTurns,
    aggregatePlanMetrics,
    ANALYTICS_PAGE_LIMIT,
    bucketByPeriod,
    buildChatTurnsQuery,
    buildChatTurnsStatsQuery,
    buildPlanMetricsQuery,
    buildPlanMetricsStatsQuery,
    countByKey,
    dayKeyUtc,
    fetchAllPages,
    formatDayLabel,
    formatMonthLabel,
    formatMs,
    formatPct,
    formatPeriodLabel,
    formatUsd,
    formatWeekLabel,
    granularityForRange,
    loadAnalytics,
    percentile,
    RANGE_OPTIONS,
    rangeForKey,
    safeDiv,
    type AdminChatTurn,
    type AdminPlanMetric,
    type AnalyticsPage,
    type AnalyticsRange,
    type ApiCall,
} from '../lib/analyticsQueries';

const NOW = new Date('2026-07-22T10:00:00.000Z');

/** Bucket count of a range at a granularity (via zero-filled series). */
const bucketCount = (range: AnalyticsRange, granularity: 'day' | 'week' | 'month') =>
    bucketByPeriod<{ at: string }>([], range, granularity, (i) => i.at).length;

describe('rangeForKey (presets, anclado a medianoche UTC)', () => {
    it('rangos finitos: from = 00:00Z de hace N-1 días; to = now', () => {
        expect(rangeForKey('7d', NOW)).toEqual({
            from: '2026-07-16T00:00:00.000Z',
            to: '2026-07-22T10:00:00.000Z',
        });
        expect(rangeForKey('30d', NOW).from).toBe('2026-06-23T00:00:00.000Z');
    });

    it('1 año = 365 días: from = hace 364 días a medianoche UTC', () => {
        expect(rangeForKey('1y', NOW).from).toBe('2025-07-23T00:00:00.000Z');
    });

    it('all-time: from = null (sin límite inferior), to = now', () => {
        expect(rangeForKey('all', NOW)).toEqual({ from: null, to: '2026-07-22T10:00:00.000Z' });
    });

    it('un rango de N días produce exactamente N buckets diarios; solo el último es parcial', () => {
        expect(bucketCount(rangeForKey('7d', NOW), 'day')).toBe(7);
        expect(bucketCount(rangeForKey('30d', NOW), 'day')).toBe(30);
    });

    it('RANGE_OPTIONS: 5 presets con su granularidad', () => {
        expect(RANGE_OPTIONS.map((o) => o.key)).toEqual(['7d', '30d', '90d', '1y', 'all']);
        expect(RANGE_OPTIONS.find((o) => o.key === 'all')?.days).toBeNull();
        expect(RANGE_OPTIONS.find((o) => o.key === '1y')?.days).toBe(365);
    });

    it('granularityForRange: día(7/30) · semana(90) · mes(1y/all)', () => {
        expect(granularityForRange('7d')).toBe('day');
        expect(granularityForRange('30d')).toBe('day');
        expect(granularityForRange('90d')).toBe('week');
        expect(granularityForRange('1y')).toBe('month');
        expect(granularityForRange('all')).toBe('month');
    });
});

describe('query builders (endpoints /admin/analytics/*)', () => {
    const range = rangeForKey('7d', NOW);

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

    it('all-time: los builders OMITEN `from` (solo to); el backend lo lee como sin límite inferior', () => {
        const all = rangeForKey('all', NOW);
        expect(buildChatTurnsStatsQuery(all)).toBe(
            '/admin/analytics/chat-turns/stats?to=2026-07-22T10%3A00%3A00.000Z',
        );
        expect(buildChatTurnsQuery(all, 200, 0)).toBe(
            '/admin/analytics/chat-turns?to=2026-07-22T10%3A00%3A00.000Z&limit=200&offset=0',
        );
        expect(buildPlanMetricsQuery(all, 200, 0)).not.toContain('from=');
        expect(buildPlanMetricsStatsQuery(all)).not.toContain('from=');
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

describe('bucketByPeriod · granularidad diaria', () => {
    const range: AnalyticsRange = { from: '2026-07-20T06:00:00.000Z', to: '2026-07-22T10:00:00.000Z' };

    it('dayKeyUtc normaliza offsets no-UTC al día UTC', () => {
        expect(dayKeyUtc('2026-07-22T01:30:00+03:00')).toBe('2026-07-21');
        expect(dayKeyUtc('2026-07-22T23:30:00-02:00')).toBe('2026-07-23');
    });

    it('cubre el rango inclusive, en orden, con clave por día', () => {
        expect(bucketByPeriod<{ at: string }>([], range, 'day', (i) => i.at).map((b) => b.key))
            .toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
    });

    it('rellena con cero los días sin datos y descarta items fuera de rango', () => {
        const items = [
            { at: '2026-07-20T08:00:00Z' },
            { at: '2026-07-20T09:00:00Z' },
            { at: '2026-07-22T01:00:00Z' },
            { at: '2026-07-01T01:00:00Z' }, // fuera de rango
        ];
        expect(bucketByPeriod(items, range, 'day', (i) => i.at).map((b) => [b.key, b.total])).toEqual([
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
        const [first] = bucketByPeriod(items, range, 'day', (i) => i.at, (i) => i.source);
        expect(first.total).toBe(3);
        expect(first.counts).toEqual({ chat: 2, wizard: 1 });
    });
});

describe('bucketByPeriod · granularidad semanal (bloques de 7 días anclados al final)', () => {
    // to = 2026-07-22 → el último bloque cierra en 07-22 (07-16..07-22).
    const range: AnalyticsRange = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-22T10:00:00.000Z' };

    it('las claves son el día de inicio de cada bloque de 7 días, hacia atrás desde `to`', () => {
        expect(bucketByPeriod<{ at: string }>([], range, 'week', (i) => i.at).map((b) => b.key))
            .toEqual(['2026-06-25', '2026-07-02', '2026-07-09', '2026-07-16']);
    });

    it('asigna cada item a su bloque semanal y descarta lo anterior al primer bloque', () => {
        const items = [
            { at: '2026-07-22T09:00:00Z' }, // bloque 07-16
            { at: '2026-07-16T00:30:00Z' }, // bloque 07-16 (borde inferior del bloque final)
            { at: '2026-07-15T12:00:00Z' }, // bloque 07-09 (borde superior)
            { at: '2026-07-02T00:00:00Z' }, // bloque 07-02
            { at: '2026-06-25T23:00:00Z' }, // bloque 06-25
            { at: '2026-06-10T00:00:00Z' }, // fuera de rango → descartado
        ];
        expect(bucketByPeriod(items, range, 'week', (i) => i.at).map((b) => [b.key, b.total])).toEqual([
            ['2026-06-25', 1],
            ['2026-07-02', 1],
            ['2026-07-09', 1],
            ['2026-07-16', 2],
        ]);
    });
});

describe('bucketByPeriod · granularidad mensual', () => {
    it('cubre los meses calendario del rango, inclusive, en orden', () => {
        const range: AnalyticsRange = { from: '2026-05-10T00:00:00.000Z', to: '2026-07-22T10:00:00.000Z' };
        const items = [
            { at: '2026-05-31T23:00:00Z' },
            { at: '2026-06-01T00:00:00Z' },
            { at: '2026-07-22T09:00:00Z' },
            { at: '2026-07-10T00:00:00Z' },
            { at: '2026-04-30T00:00:00Z' }, // fuera de rango → descartado
        ];
        expect(bucketByPeriod(items, range, 'month', (i) => i.at).map((b) => [b.key, b.total])).toEqual([
            ['2026-05', 1],
            ['2026-06', 1],
            ['2026-07', 2],
        ]);
    });

    it('la enumeración de meses cruza el cambio de año', () => {
        const range: AnalyticsRange = { from: '2025-11-15T00:00:00.000Z', to: '2026-01-05T10:00:00.000Z' };
        expect(bucketByPeriod<{ at: string }>([], range, 'month', (i) => i.at).map((b) => b.key))
            .toEqual(['2025-11', '2025-12', '2026-01']);
    });
});

describe('bucketByPeriod · inicio de serie all-time (from = null)', () => {
    const range: AnalyticsRange = { from: null, to: '2026-07-22T10:00:00.000Z' };

    it('deriva el inicio de la serie del createdAt MÁS ANTIGUO de la muestra y rellena con cero', () => {
        const items = [
            { at: '2026-05-01T00:00:00Z' },
            { at: '2026-03-15T00:00:00Z' }, // el más antiguo → ancla el inicio
            { at: '2026-07-20T00:00:00Z' },
        ];
        expect(bucketByPeriod(items, range, 'month', (i) => i.at).map((b) => [b.key, b.total])).toEqual([
            ['2026-03', 1],
            ['2026-04', 0],
            ['2026-05', 1],
            ['2026-06', 0],
            ['2026-07', 1],
        ]);
    });

    it('muestra all-time vacía → serie vacía (no hay lower bound del que partir)', () => {
        expect(bucketByPeriod<{ at: string }>([], range, 'month', (i) => i.at)).toEqual([]);
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
    const range: AnalyticsRange = { from: '2026-07-21T00:00:00.000Z', to: '2026-07-22T10:00:00.000Z' };

    const turn = (over: Partial<AdminChatTurn>): AdminChatTurn => ({
        id: '1', createdAt: '2026-07-21T08:00:00Z', sessionId: null, userId: null,
        turnIndex: 0, aiProvider: 'gemini', model: 'gemini-3.1-flash-lite', promptVersion: 'v1',
        promptChars: 100, finishReason: 'STOP', latencyMs: 500, inputTokens: 10, outputTokens: 20,
        thinkingTokens: 0, totalTokens: 30, costUsd: 0.0004, geminiStatus: 200,
        errorCode: null, errorMessage: null, slotCompleteness: 3,
        ...over,
    });

    it('aggregateChatTurns: serie por periodo, percentiles y mix provider · model', () => {
        const agg = aggregateChatTurns([
            turn({ latencyMs: 200 }),
            turn({ latencyMs: 800, createdAt: '2026-07-22T09:00:00Z' }),
            turn({ latencyMs: 400, aiProvider: 'openai', model: 'gpt-5-nano' }),
        ], range, 'day');

        expect(agg.turnsPerPeriod.map((b) => b.total)).toEqual([2, 1]);
        expect(agg.latencyP50).toBe(400);
        expect(agg.latencyP95).toBe(800);
        expect(agg.providerModelMix.map((m) => m.key)).toEqual([
            'gemini · gemini-3.1-flash-lite',
            'openai · gpt-5-nano',
        ]);
    });

    it('aggregateChatTurns sin datos: percentiles null, series a cero', () => {
        const agg = aggregateChatTurns([], range, 'day');
        expect(agg.latencyP50).toBeNull();
        expect(agg.latencyP95).toBeNull();
        expect(agg.turnsPerPeriod.every((b) => b.total === 0)).toBe(true);
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
        ], range, 'day');

        expect(agg.sources).toEqual(['chat', 'wizard']);
        expect(agg.sourceMix[0]).toEqual({ key: 'chat', count: 2, share: 2 / 3 });
        expect(agg.plansPerPeriodBySource[0].counts).toEqual({ chat: 2, wizard: 1 });
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

        const snapshot = await loadAnalytics(api, '7d', { now: NOW, signal: controller.signal });

        expect(paths).toHaveLength(4);
        expect(seenSignals.every((s) => s === controller.signal)).toBe(true);
        expect(snapshot.error).toBeNull();
        expect(snapshot.aborted).toBe(false);
    });

    it('snapshot feliz: stats + agregados coherentes con el rango', async () => {
        const { api } = makeApi();
        const snapshot = await loadAnalytics(api, '7d', { now: NOW });

        expect(snapshot.chatStats?.totalTurns).toBe(1);
        expect(snapshot.chatAggregate.turnsPerPeriod).toHaveLength(7);
        expect(snapshot.planAggregate.sources).toEqual(['chat']);
        expect(snapshot.truncated).toBe(false);
    });

    it('all-time: omite `from` en las 4 rutas y deriva la serie mensual de la muestra', async () => {
        const { api, paths } = makeApi({
            chatTurns: [{ createdAt: '2026-05-10T08:00:00Z' }, { createdAt: '2026-07-20T08:00:00Z' }],
        });

        const snapshot = await loadAnalytics(api, 'all', { now: NOW });

        expect(paths).toHaveLength(4);
        expect(paths.every((p) => !p.includes('from='))).toBe(true);
        // Serie mensual desde el más antiguo de la muestra (mayo) hasta `to` (julio).
        expect(snapshot.chatAggregate.turnsPerPeriod.map((b) => b.key)).toEqual([
            '2026-05', '2026-06', '2026-07',
        ]);
    });

    it('MINOR-4: un throw en la agregación (ISO inválido) resuelve en snapshot de error, nunca rechaza', async () => {
        const { api } = makeApi({ chatTurns: [{ createdAt: 'not-a-date' }] });

        const snapshot = await loadAnalytics(api, '7d', { now: NOW });

        expect(snapshot.error).toBeTruthy();
        expect(snapshot.chatStats).toBeNull();
        expect(snapshot.chatAggregate.turnsPerPeriod.every((b) => b.total === 0)).toBe(true);
    });

    it('el error de un endpoint aflora en el snapshot sin tumbar el resto', async () => {
        const base = makeApi();
        const api: ApiCall = async <T,>(path: string, options?: { signal?: AbortSignal }) => {
            if (path.startsWith('/admin/analytics/plan-metrics/stats')) {
                return { data: null, error: 'HTTP 500' };
            }
            return base.api<T>(path, options);
        };

        const snapshot = await loadAnalytics(api, '7d', { now: NOW });

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

    it('formatWeekLabel: span de 7 días desde el inicio de bloque', () => {
        expect(formatWeekLabel('2026-06-22')).toBe('22–28 Jun');
        // Bloque que cruza el cambio de mes.
        expect(formatWeekLabel('2026-06-29')).toBe('29 Jun–5 Jul');
    });

    it('formatMonthLabel: mes corto + año de 2 dígitos', () => {
        expect(formatMonthLabel('2026-07')).toBe('Jul 26');
        expect(formatMonthLabel('2026-01')).toBe('Jan 26');
    });

    it('formatPeriodLabel despacha por granularidad', () => {
        expect(formatPeriodLabel('2026-07-22', 'day')).toBe('22 Jul');
        expect(formatPeriodLabel('2026-06-22', 'week')).toBe('22–28 Jun');
        expect(formatPeriodLabel('2026-07', 'month')).toBe('Jul 26');
    });
});
