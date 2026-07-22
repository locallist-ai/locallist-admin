import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { shouldApplyResponse } from '../lib/raceGuard';
import {
    aggregateChatTurns,
    aggregatePlanMetrics,
    buildChatTurnsQuery,
    buildChatTurnsStatsQuery,
    buildPlanMetricsQuery,
    buildPlanMetricsStatsQuery,
    fetchAllPages,
    rangeBounds,
    type AdminChatTurn,
    type AdminChatTurnsListResponse,
    type AdminChatTurnsStats,
    type AdminPlanMetric,
    type AdminPlanMetricsListResponse,
    type AdminPlanMetricsStats,
    type ChatTurnsAggregate,
    type PlanMetricsAggregate,
    type RangeDays,
} from '../lib/analyticsQueries';

/**
 * Data side of the Analytics screen. Per range it issues four requests
 * in parallel: the two /stats endpoints (exact scalars over the range)
 * and the two paginated lists, accumulated client-side for the
 * distributions the backend does not aggregate (per-day series,
 * latency percentiles, provider/model mix). React wiring over
 * `src/lib/analyticsQueries.ts`.
 *
 * EXTENSION POINT (fase 2 — monetización): when the backend exposes
 * /admin/billing/metrics, add its stats request to the Promise.all
 * below and surface a third block alongside chat/plans.
 */
export function useAnalyticsData() {
    const [rangeDays, setRangeDays] = useState<RangeDays>(7);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** True when a list hit the client page cap: distributions are a sample. */
    const [truncated, setTruncated] = useState(false);

    const [chatStats, setChatStats] = useState<AdminChatTurnsStats | null>(null);
    const [chatAggregate, setChatAggregate] = useState<ChatTurnsAggregate | null>(null);
    const [planStats, setPlanStats] = useState<AdminPlanMetricsStats | null>(null);
    const [planAggregate, setPlanAggregate] = useState<PlanMetricsAggregate | null>(null);

    // Monotonic id so a stale response can never clobber a newer range.
    const requestIdRef = useRef(0);

    const load = useCallback(async (days: RangeDays) => {
        const reqId = ++requestIdRef.current;
        setLoading(true);
        setError(null);

        const range = rangeBounds(days);

        const [chatStatsRes, chatTurnsRes, planStatsRes, planMetricsRes] = await Promise.all([
            api<AdminChatTurnsStats>(buildChatTurnsStatsQuery(range)),
            fetchAllPages<AdminChatTurn>(async (limit, offset) => {
                const res = await api<AdminChatTurnsListResponse>(buildChatTurnsQuery(range, limit, offset));
                return {
                    data: res.data ? { items: res.data.turns, total: res.data.total } : null,
                    error: res.error,
                };
            }),
            api<AdminPlanMetricsStats>(buildPlanMetricsStatsQuery(range)),
            fetchAllPages<AdminPlanMetric>(async (limit, offset) => {
                const res = await api<AdminPlanMetricsListResponse>(buildPlanMetricsQuery(range, limit, offset));
                return {
                    data: res.data ? { items: res.data.metrics, total: res.data.total } : null,
                    error: res.error,
                };
            }),
        ]);

        if (!shouldApplyResponse(reqId, requestIdRef.current)) return;

        setChatStats(chatStatsRes.data);
        setChatAggregate(aggregateChatTurns(chatTurnsRes.items, range));
        setPlanStats(planStatsRes.data);
        setPlanAggregate(aggregatePlanMetrics(planMetricsRes.items, range));
        setTruncated(chatTurnsRes.truncated || planMetricsRes.truncated);
        setError(chatStatsRes.error ?? chatTurnsRes.error ?? planStatsRes.error ?? planMetricsRes.error);
        setLoading(false);
    }, []);

    useEffect(() => {
        load(rangeDays);
    }, [rangeDays, load]);

    return {
        rangeDays,
        setRangeDays,
        loading,
        error,
        truncated,
        chatStats,
        chatAggregate,
        planStats,
        planAggregate,
        reload: () => load(rangeDays),
    };
}
