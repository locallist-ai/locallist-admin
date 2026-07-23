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

/** Preset ranges offered by the chips. `all` has no lower bound. */
export type RangeKey = '7d' | '30d' | '90d' | '1y' | 'all';

/**
 * Time granularity of the per-period series for a range: short ranges
 * stay daily, a quarter rolls up to weeks, a year and all-time to
 * calendar months. Keeps the bar count readable across every preset.
 */
export type Granularity = 'day' | 'week' | 'month';

export interface RangeOption {
    key: RangeKey;
    label: string;
    /** Window length in days; `null` for all-time (no lower bound). */
    days: number | null;
    granularity: Granularity;
}

export const RANGE_OPTIONS: RangeOption[] = [
    // Compact labels keep all five chips on one row on a phone.
    { key: '7d', label: '7d', days: 7, granularity: 'day' },
    { key: '30d', label: '30d', days: 30, granularity: 'day' },
    { key: '90d', label: '90d', days: 90, granularity: 'week' },
    { key: '1y', label: '1y', days: 365, granularity: 'month' },
    { key: 'all', label: 'All', days: null, granularity: 'month' },
];

const RANGE_OPTION_BY_KEY: Record<RangeKey, RangeOption> = Object.fromEntries(
    RANGE_OPTIONS.map((o) => [o.key, o]),
) as Record<RangeKey, RangeOption>;

export function granularityForRange(key: RangeKey): Granularity {
    return RANGE_OPTION_BY_KEY[key].granularity;
}

export interface AnalyticsRange {
    /**
     * ISO timestamp, inclusive lower bound. `null` for all-time: the
     * query then omits `from` and the series start is derived from the
     * oldest row in the downloaded sample.
     */
    from: string | null;
    /** ISO timestamp, inclusive upper bound. */
    to: string;
}

const DAY_MS = 86_400_000;

/**
 * Bounds for a preset. Finite windows anchor `from` to UTC midnight so a
 * range of N days yields exactly N daily buckets — 00:00Z of
 * (today − N−1 days) — and only the last bucket ("today") is partial.
 * All-time yields `from: null` (no lower bound); its series start comes
 * from the sample, not from here.
 */
export function rangeForKey(key: RangeKey, now: Date = new Date()): AnalyticsRange {
    const { days } = RANGE_OPTION_BY_KEY[key];
    if (days == null) {
        return { from: null, to: now.toISOString() };
    }
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return {
        from: new Date(todayUtc - (days - 1) * DAY_MS).toISOString(),
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
    // All-time: omit `from` entirely — the backend reads a missing lower
    // bound as "since the beginning" (`from`/`to` are optional there).
    if (range.from != null) params.set('from', range.from);
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

/** Midnight-UTC epoch ms of the calendar day an ISO timestamp falls on. */
function dayStartMs(iso: string): number {
    return Date.parse(`${dayKeyUtc(iso)}T00:00:00Z`);
}

/** 'YYYY-MM-DD' of a midnight-UTC epoch ms. */
function isoDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Bucket key an ISO timestamp maps to under a granularity.
 *  - day:   its UTC day  ('2026-07-22').
 *  - week:  the START day of the 7-day block it belongs to. Blocks are
 *           ANCHORED to the END of the range (not ISO Monday weeks) so
 *           the most recent block always closes exactly on `to`; that
 *           keeps "the last bar is today's partial week" true for every
 *           range, at the cost of week edges not landing on weekdays.
 *  - month: its UTC calendar month ('2026-07').
 * `anchorDayMs` (midnight UTC of `to`) is only read for the week case.
 */
function periodKey(dayMs: number, granularity: Granularity, anchorDayMs: number): string {
    if (granularity === 'month') return isoDay(dayMs).slice(0, 7);
    if (granularity === 'week') {
        const blocksBack = Math.floor((anchorDayMs - dayMs) / (7 * DAY_MS));
        return isoDay(anchorDayMs - blocksBack * 7 * DAY_MS - 6 * DAY_MS);
    }
    return isoDay(dayMs);
}

/**
 * The effective series start (midnight-UTC ms): the range's lower bound
 * when finite, otherwise — for all-time — the OLDEST row in the sample.
 * That mirrors the truncation semantics: a capped sample holds the most
 * RECENT rows, so anchoring all-time to the sample's oldest row keeps
 * the series to the span we actually have data for. Null when all-time
 * has no rows at all (empty series).
 */
function seriesStartMs<T>(range: AnalyticsRange, items: T[], getIso: (item: T) => string): number | null {
    if (range.from != null) return dayStartMs(range.from);
    if (items.length === 0) return null;
    let min = Infinity;
    for (const item of items) min = Math.min(min, dayStartMs(getIso(item)));
    return min === Infinity ? null : min;
}

/** Ordered, gap-free list of bucket keys spanning [startMs, endMs]. */
function listPeriodKeys(startMs: number, endMs: number, granularity: Granularity, anchorDayMs: number): string[] {
    const keys: string[] = [];
    if (granularity === 'month') {
        let y = new Date(startMs).getUTCFullYear();
        let m = new Date(startMs).getUTCMonth();
        const endY = new Date(endMs).getUTCFullYear();
        const endM = new Date(endMs).getUTCMonth();
        while (y < endY || (y === endY && m <= endM)) {
            keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
            if (++m > 11) { m = 0; y++; }
        }
        return keys;
    }
    const step = granularity === 'week' ? 7 * DAY_MS : DAY_MS;
    // Snap the ends onto block starts so iteration lands on real keys.
    const first = Date.parse(`${periodKey(startMs, granularity, anchorDayMs)}T00:00:00Z`);
    const last = Date.parse(`${periodKey(endMs, granularity, anchorDayMs)}T00:00:00Z`);
    for (let t = first; t <= last; t += step) keys.push(periodKey(t, granularity, anchorDayMs));
    return keys;
}

export interface PeriodBucket {
    /** Bucket key: UTC day, week-start day, or 'YYYY-MM' month. */
    key: string;
    total: number;
    /** Per-series counts when a series key extractor is given. */
    counts: Record<string, number>;
}

/**
 * Buckets items into the range's periods at the given granularity
 * (zero-filled, ordered), optionally split per series key. Items outside
 * the covered span are dropped. For all-time the span starts at the
 * sample's oldest row (see `seriesStartMs`); an empty all-time sample
 * yields an empty series.
 */
export function bucketByPeriod<T>(
    items: T[],
    range: AnalyticsRange,
    granularity: Granularity,
    getIso: (item: T) => string,
    getKey?: (item: T) => string,
): PeriodBucket[] {
    const anchorDayMs = dayStartMs(range.to);
    const startMs = seriesStartMs(range, items, getIso);
    const keys = startMs == null ? [] : listPeriodKeys(startMs, anchorDayMs, granularity, anchorDayMs);
    const buckets = new Map<string, PeriodBucket>(
        keys.map((key) => [key, { key, total: 0, counts: {} }]),
    );
    for (const item of items) {
        const bucket = buckets.get(periodKey(dayStartMs(getIso(item)), granularity, anchorDayMs));
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
    /** Per-period series (daily/weekly/monthly per the range granularity). */
    turnsPerPeriod: PeriodBucket[];
    latencyP50: number | null;
    latencyP95: number | null;
    /** Key format: `${aiProvider} · ${model}`. */
    providerModelMix: MixEntry[];
}

export function aggregateChatTurns(
    turns: AdminChatTurn[],
    range: AnalyticsRange,
    granularity: Granularity,
): ChatTurnsAggregate {
    const latencies = turns.map((t) => t.latencyMs);
    return {
        turnsPerPeriod: bucketByPeriod(turns, range, granularity, (t) => t.createdAt),
        latencyP50: percentile(latencies, 50),
        latencyP95: percentile(latencies, 95),
        providerModelMix: countByKey(turns, (t) => `${t.aiProvider} · ${t.model}`),
    };
}

export interface PlanMetricsAggregate {
    /** Per-period series split by generation source. */
    plansPerPeriodBySource: PeriodBucket[];
    sourceMix: MixEntry[];
    /** Distinct generation sources, alphabetical — stable series/color order. */
    sources: string[];
}

export function aggregatePlanMetrics(
    metrics: AdminPlanMetric[],
    range: AnalyticsRange,
    granularity: Granularity,
): PlanMetricsAggregate {
    return {
        plansPerPeriodBySource: bucketByPeriod(metrics, range, granularity, (m) => m.createdAt, (m) => m.generationSource),
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
    rangeKey: RangeKey,
    {
        now = new Date(),
        signal,
        pageLimit = ANALYTICS_PAGE_LIMIT,
        maxPages = ANALYTICS_MAX_PAGES,
    }: { now?: Date; signal?: AbortSignal; pageLimit?: number; maxPages?: number } = {},
): Promise<AnalyticsSnapshot> {
    const range = rangeForKey(rangeKey, now);
    const granularity = granularityForRange(rangeKey);
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
            chatAggregate: aggregateChatTurns(chatTurnsRes.items, range, granularity),
            planStats: planStatsRes.data,
            planAggregate: aggregatePlanMetrics(planMetricsRes.items, range, granularity),
            truncated: chatTurnsRes.truncated || planMetricsRes.truncated,
            aborted: chatTurnsRes.aborted || planMetricsRes.aborted || (signal?.aborted ?? false),
            error: chatStatsRes.error ?? chatTurnsRes.error ?? planStatsRes.error ?? planMetricsRes.error,
        };
    } catch (err) {
        return {
            chatStats: null,
            chatAggregate: aggregateChatTurns([], range, granularity),
            planStats: null,
            planAggregate: aggregatePlanMetrics([], range, granularity),
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

/**
 * Week-start day → the 7-day span it opens: '2026-06-22' → '22–28 Jun'
 * (or '29 Jun–5 Jul' when the block straddles a month boundary).
 */
export function formatWeekLabel(weekStart: string): string {
    const startMs = Date.parse(`${weekStart}T00:00:00Z`);
    const start = new Date(startMs);
    const end = new Date(startMs + 6 * DAY_MS);
    const startMonth = MONTHS[start.getUTCMonth()] ?? '?';
    const endMonth = MONTHS[end.getUTCMonth()] ?? '?';
    return startMonth === endMonth
        ? `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth}`
        : `${start.getUTCDate()} ${startMonth}–${end.getUTCDate()} ${endMonth}`;
}

/** '2026-07' → 'Jul 26' (axis label for the per-month bars). */
export function formatMonthLabel(month: string): string {
    const m = Number(month.slice(5, 7));
    return `${MONTHS[m - 1] ?? '?'} ${month.slice(2, 4)}`;
}

/** Picks the axis-label formatter matching a series' granularity. */
export function formatPeriodLabel(key: string, granularity: Granularity): string {
    if (granularity === 'week') return formatWeekLabel(key);
    if (granularity === 'month') return formatMonthLabel(key);
    return formatDayLabel(key);
}
