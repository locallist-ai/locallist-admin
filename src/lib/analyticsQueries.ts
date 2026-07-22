/**
 * Pure logic behind the Analytics screen (app/(app)/analytics.tsx):
 * date-range bounds, query builders for the admin analytics endpoints,
 * the page-accumulation loop, and the client-side aggregations the
 * backend stats endpoints don't provide (per-day series, latency
 * percentiles, provider/model mix). Extracted so it is unit-testable
 * in vitest (native modules don't resolve in Node).
 *
 * Backend contract (locallist-api-net, Features/Admin/Analytics):
 * - GET /admin/analytics/chat-turns          ?limit(1-200)&offset&sessionId&userId&hasError&from&to
 * - GET /admin/analytics/chat-turns/stats    ?from&to
 * - GET /admin/analytics/plan-metrics        ?limit(1-200)&offset&city&source&wasOpened&wasFollowed&from&to
 * - GET /admin/analytics/plan-metrics/stats  ?from&to&city
 *
 * Scalars exact over the range (totals, rates, averages) come from the
 * /stats endpoints; distributions come from the paginated lists (newest
 * first — CreatedAt DESC), capped at ANALYTICS_MAX_PAGES pages and
 * flagged `truncated` beyond that: a truncated sample is the MOST
 * RECENT rows of the range, so older days may be incomplete.
 *
 * Wire-format gotchas:
 * - The backend serializes with `WhenWritingNull`: every `| null` field
 *   below arrives as an ABSENT property (undefined) at runtime. Keep
 *   null checks loose (`!= null` / `?? `), never `=== null`.
 * - `avgSlotCompleteness: 0` in the stats DTO is ambiguous: the backend
 *   returns 0 both when no turn carried a slotCompleteness value and
 *   when the real average is 0. Treat it as "no signal" only when
 *   `totalTurns` is 0; otherwise display it as-is.
 */

// ─── Backend DTOs (camelCase over the wire) ──────────────────────────

export interface AdminChatTurn {
    id: string;
    createdAt: string;
    sessionId: string | null;
    userId: string | null;
    turnIndex: number;
    aiProvider: string;
    model: string;
    promptVersion: string;
    promptChars: number;
    finishReason: string | null;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    thinkingTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    geminiStatus: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    slotCompleteness: number | null;
}

export interface AdminChatTurnsListResponse {
    turns: AdminChatTurn[];
    total: number;
    limit: number;
    offset: number;
}

export interface AdminChatTurnsStats {
    totalTurns: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalThinkingTokens: number;
    totalCostUsd: number;
    avgSlotCompleteness: number;
    errorRate: number;
    finishReasonBreakdown: Record<string, number>;
    errorCodeBreakdown: Record<string, number>;
}

export interface AdminPlanMetric {
    id: string;
    createdAt: string;
    planId: string;
    planName: string | null;
    planCity: string | null;
    generationSource: string;
    signalsFilled: number;
    numDays: number;
    numStops: number;
    numCategories: number;
    groupType: string | null;
    budget: string | null;
    latencyMs: number;
    costUsd: number | null;
    wasOpened: boolean;
    openedAt: string | null;
    wasFollowed: boolean;
    followedAt: string | null;
    editedCount: number;
    regenerated: boolean;
}

export interface AdminPlanMetricsListResponse {
    metrics: AdminPlanMetric[];
    total: number;
    limit: number;
    offset: number;
}

export interface AdminPlanMetricsByCity {
    city: string;
    count: number;
    openRate: number;
    followRate: number;
}

export interface AdminPlanMetricsStats {
    totalPlans: number;
    openRate: number;
    followRate: number;
    avgLatencyMs: number;
    totalCostUsd: number;
    byCity: AdminPlanMetricsByCity[];
}

// ─── Range ───────────────────────────────────────────────────────────

export type RangeDays = 7 | 30;

export const RANGE_OPTIONS: { days: RangeDays; label: string }[] = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
];

export interface AnalyticsRange {
    /** ISO timestamp, inclusive lower bound. */
    from: string;
    /** ISO timestamp, inclusive upper bound. */
    to: string;
}

/**
 * Anchored to UTC midnight so a range of N days yields exactly N daily
 * buckets: `from` is 00:00Z of (today − N−1 days) and `to` is `now`.
 * Only the last bucket ("today") is partial.
 */
export function rangeBounds(days: RangeDays, now: Date = new Date()): AnalyticsRange {
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return {
        from: new Date(todayUtc - (days - 1) * 86_400_000).toISOString(),
        to: now.toISOString(),
    };
}

// ─── Query builders ──────────────────────────────────────────────────

/** Backend clamps `limit` to [1, 200]; ask for the max per page. */
export const ANALYTICS_PAGE_LIMIT = 200;
/** Client-side safety cap on the accumulation loop (pages × limit rows). */
export const ANALYTICS_MAX_PAGES = 10;

function rangeParams(range: AnalyticsRange): URLSearchParams {
    const params = new URLSearchParams();
    params.set('from', range.from);
    params.set('to', range.to);
    return params;
}

export function buildChatTurnsQuery(range: AnalyticsRange, limit: number, offset: number): string {
    const params = rangeParams(range);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return `/admin/analytics/chat-turns?${params}`;
}

export function buildChatTurnsStatsQuery(range: AnalyticsRange): string {
    return `/admin/analytics/chat-turns/stats?${rangeParams(range)}`;
}

export function buildPlanMetricsQuery(range: AnalyticsRange, limit: number, offset: number): string {
    const params = rangeParams(range);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return `/admin/analytics/plan-metrics?${params}`;
}

export function buildPlanMetricsStatsQuery(range: AnalyticsRange): string {
    return `/admin/analytics/plan-metrics/stats?${rangeParams(range)}`;
}

// ─── Page accumulation ───────────────────────────────────────────────

export interface AnalyticsPage<T> {
    items: T[];
    total: number;
}

export interface AnalyticsPageResponse<T> {
    data: AnalyticsPage<T> | null;
    error: string | null;
}

export interface FetchAllResult<T> {
    items: T[];
    total: number;
    /** True when the cap or an abort stopped the loop before `total`. */
    truncated: boolean;
    /** True when the provided AbortSignal fired mid-loop. */
    aborted: boolean;
    error: string | null;
}

export interface FetchAllOptions<T> {
    pageLimit?: number;
    maxPages?: number;
    /** Stops the loop between pages when it fires (stale range change). */
    signal?: AbortSignal;
    /**
     * Deduplicates rows across page boundaries: the backend orders by
     * CreatedAt DESC without a tiebreaker, so tied timestamps at a page
     * boundary can repeat a row on the next page.
     */
    getId?: (item: T) => string;
}

/**
 * Accumulates every page of a list endpoint (API call injected so the
 * loop is unit-testable). Stops when all `total` rows are collected,
 * when the server returns a short page, at `maxPages`, or when the
 * signal aborts — the cap flags the result as truncated so the UI can
 * say "sample". The offset advances by rows FETCHED (not kept), so
 * dedupe never refetches the same window.
 */
export async function fetchAllPages<T>(
    fetchPage: (limit: number, offset: number) => Promise<AnalyticsPageResponse<T>>,
    { pageLimit = ANALYTICS_PAGE_LIMIT, maxPages = ANALYTICS_MAX_PAGES, signal, getId }: FetchAllOptions<T> = {},
): Promise<FetchAllResult<T>> {
    const items: T[] = [];
    const seen = new Set<string>();
    let fetched = 0;
    let total = 0;

    for (let page = 0; page < maxPages; page++) {
        if (signal?.aborted) {
            return { items, total, truncated: fetched < total, aborted: true, error: null };
        }

        const res = await fetchPage(pageLimit, fetched);
        if (!res.data) {
            return {
                items, total,
                truncated: fetched < total,
                aborted: signal?.aborted ?? false,
                error: res.error ?? 'unknown error',
            };
        }

        fetched += res.data.items.length;
        for (const item of res.data.items) {
            if (getId) {
                const id = getId(item);
                if (seen.has(id)) continue;
                seen.add(id);
            }
            items.push(item);
        }
        total = res.data.total;

        // A short page also terminates: `total` may drift while paging.
        if (fetched >= total || res.data.items.length < pageLimit) {
            return { items, total, truncated: false, aborted: false, error: null };
        }
    }

    return { items, total, truncated: fetched < total, aborted: false, error: null };
}

// ─── Aggregations ────────────────────────────────────────────────────

/** Nearest-rank percentile (p in [0, 100]); null on an empty sample. */
export function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** UTC calendar day ('YYYY-MM-DD') of an ISO timestamp, offset-normalized. */
export function dayKeyUtc(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
}

/** Every UTC day covered by the range, in order (inclusive both ends). */
export function listDaysUtc(range: AnalyticsRange): string[] {
    const days: string[] = [];
    const start = Date.parse(`${dayKeyUtc(range.from)}T00:00:00Z`);
    const end = Date.parse(`${dayKeyUtc(range.to)}T00:00:00Z`);
    for (let t = start; t <= end; t += 86_400_000) {
        days.push(new Date(t).toISOString().slice(0, 10));
    }
    return days;
}

export interface DayBucket {
    day: string;
    total: number;
    /** Per-series counts when a series key extractor is given. */
    counts: Record<string, number>;
}

/**
 * Buckets items into the range's UTC days (zero-filled, ordered),
 * optionally split per series key. Items outside the range are dropped.
 */
export function bucketByDay<T>(
    items: T[],
    range: AnalyticsRange,
    getIso: (item: T) => string,
    getKey?: (item: T) => string,
): DayBucket[] {
    const buckets = new Map<string, DayBucket>(
        listDaysUtc(range).map((day) => [day, { day, total: 0, counts: {} }]),
    );
    for (const item of items) {
        const bucket = buckets.get(dayKeyUtc(getIso(item)));
        if (!bucket) continue;
        bucket.total++;
        if (getKey) {
            const key = getKey(item);
            bucket.counts[key] = (bucket.counts[key] ?? 0) + 1;
        }
    }
    return [...buckets.values()];
}

export interface MixEntry {
    key: string;
    count: number;
    /** Fraction of the sample, in [0, 1]. */
    share: number;
}

/** Counts per key, sorted by count desc then key asc. */
export function countByKey<T>(items: T[], getKey: (item: T) => string): MixEntry[] {
    const counts = new Map<string, number>();
    for (const item of items) {
        const key = getKey(item);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([key, count]) => ({ key, count, share: count / items.length }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export interface ChatTurnsAggregate {
    turnsPerDay: DayBucket[];
    latencyP50: number | null;
    latencyP95: number | null;
    /** Key format: `${aiProvider} · ${model}`. */
    providerModelMix: MixEntry[];
}

export function aggregateChatTurns(turns: AdminChatTurn[], range: AnalyticsRange): ChatTurnsAggregate {
    const latencies = turns.map((t) => t.latencyMs);
    return {
        turnsPerDay: bucketByDay(turns, range, (t) => t.createdAt),
        latencyP50: percentile(latencies, 50),
        latencyP95: percentile(latencies, 95),
        providerModelMix: countByKey(turns, (t) => `${t.aiProvider} · ${t.model}`),
    };
}

export interface PlanMetricsAggregate {
    plansPerDayBySource: DayBucket[];
    sourceMix: MixEntry[];
    /** Distinct generation sources, alphabetical — stable series/color order. */
    sources: string[];
}

export function aggregatePlanMetrics(metrics: AdminPlanMetric[], range: AnalyticsRange): PlanMetricsAggregate {
    return {
        plansPerDayBySource: bucketByDay(metrics, range, (m) => m.createdAt, (m) => m.generationSource),
        sourceMix: countByKey(metrics, (m) => m.generationSource),
        sources: [...new Set(metrics.map((m) => m.generationSource))].sort(),
    };
}

/** null when the denominator is not positive (renders as an em dash). */
export function safeDiv(numerator: number, denominator: number): number | null {
    return denominator > 0 ? numerator / denominator : null;
}

// ─── Load orchestration ──────────────────────────────────────────────

/** Minimal shape of `src/lib/api.ts#api`, injected for testability. */
export type ApiCall = <T>(
    path: string,
    options?: { signal?: AbortSignal },
) => Promise<{ data: T | null; error: string | null }>;

export interface AnalyticsSnapshot {
    chatStats: AdminChatTurnsStats | null;
    chatAggregate: ChatTurnsAggregate;
    planStats: AdminPlanMetricsStats | null;
    planAggregate: PlanMetricsAggregate;
    truncated: boolean;
    aborted: boolean;
    error: string | null;
}

/**
 * One full load for a range: the two /stats endpoints plus the two
 * paginated lists (deduped by id), all in parallel and all wired to the
 * same AbortSignal so a superseded load stops paginating instead of
 * burning the shared admin rate limit. Never rejects: any throw (e.g. a
 * malformed timestamp exploding in the aggregation) becomes an error
 * snapshot so the UI always leaves the loading state.
 */
export async function loadAnalytics(
    apiCall: ApiCall,
    days: RangeDays,
    {
        now = new Date(),
        signal,
        pageLimit = ANALYTICS_PAGE_LIMIT,
        maxPages = ANALYTICS_MAX_PAGES,
    }: { now?: Date; signal?: AbortSignal; pageLimit?: number; maxPages?: number } = {},
): Promise<AnalyticsSnapshot> {
    const range = rangeBounds(days, now);
    try {
        const [chatStatsRes, chatTurnsRes, planStatsRes, planMetricsRes] = await Promise.all([
            apiCall<AdminChatTurnsStats>(buildChatTurnsStatsQuery(range), { signal }),
            fetchAllPages<AdminChatTurn>(
                async (limit, offset) => {
                    const res = await apiCall<AdminChatTurnsListResponse>(
                        buildChatTurnsQuery(range, limit, offset), { signal },
                    );
                    return { data: res.data ? { items: res.data.turns, total: res.data.total } : null, error: res.error };
                },
                { pageLimit, maxPages, signal, getId: (t) => t.id },
            ),
            apiCall<AdminPlanMetricsStats>(buildPlanMetricsStatsQuery(range), { signal }),
            fetchAllPages<AdminPlanMetric>(
                async (limit, offset) => {
                    const res = await apiCall<AdminPlanMetricsListResponse>(
                        buildPlanMetricsQuery(range, limit, offset), { signal },
                    );
                    return { data: res.data ? { items: res.data.metrics, total: res.data.total } : null, error: res.error };
                },
                { pageLimit, maxPages, signal, getId: (m) => m.id },
            ),
        ]);

        return {
            chatStats: chatStatsRes.data,
            chatAggregate: aggregateChatTurns(chatTurnsRes.items, range),
            planStats: planStatsRes.data,
            planAggregate: aggregatePlanMetrics(planMetricsRes.items, range),
            truncated: chatTurnsRes.truncated || planMetricsRes.truncated,
            aborted: chatTurnsRes.aborted || planMetricsRes.aborted || (signal?.aborted ?? false),
            error: chatStatsRes.error ?? chatTurnsRes.error ?? planStatsRes.error ?? planMetricsRes.error,
        };
    } catch (err) {
        return {
            chatStats: null,
            chatAggregate: aggregateChatTurns([], range),
            planStats: null,
            planAggregate: aggregatePlanMetrics([], range),
            truncated: false,
            aborted: signal?.aborted ?? false,
            error: err instanceof Error ? err.message : 'Unexpected error',
        };
    }
}

// ─── Display formatters ──────────────────────────────────────────────

export function formatUsd(value: number): string {
    // Per-call AI costs are fractions of a cent; keep them visible.
    return value !== 0 && Math.abs(value) < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function formatPct(ratio: number): string {
    const pct = (ratio * 100).toFixed(1);
    return `${pct.endsWith('.0') ? pct.slice(0, -2) : pct}%`;
}

export function formatMs(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-07-22' → '22 Jul' (axis label for the per-day bars). */
export function formatDayLabel(day: string): string {
    const month = Number(day.slice(5, 7));
    return `${Number(day.slice(8, 10))} ${MONTHS[month - 1] ?? '?'}`;
}
