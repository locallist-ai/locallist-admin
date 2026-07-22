import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { shouldApplyResponse } from '../lib/raceGuard';
import { loadAnalytics, type AnalyticsSnapshot, type RangeDays } from '../lib/analyticsQueries';

/**
 * Data side of the Analytics screen: thin React wiring over
 * `loadAnalytics` (src/lib/analyticsQueries.ts), which owns the four
 * parallel requests, the page accumulation and the aggregation.
 *
 * Every load gets its own AbortController; launching a new one (range
 * toggle, retry) aborts the previous so a superseded load stops
 * paginating instead of burning the shared admin rate limit, and
 * unmount aborts whatever is in flight. A monotonic request id guards
 * state on top of that (an aborted load still resolves).
 *
 * EXTENSION POINT (fase 2 — monetización): when the backend exposes
 * /admin/billing/metrics, add its request to `loadAnalytics` and
 * surface a third block alongside chat/plans.
 */
export function useAnalyticsData() {
    const [rangeDays, setRangeDays] = useState<RangeDays>(7);
    const [loading, setLoading] = useState(true);
    const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);

    const requestIdRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(async (days: RangeDays) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const reqId = ++requestIdRef.current;
        setLoading(true);
        // The previous range's data, error and truncated note must not
        // linger under the new range's spinner.
        setSnapshot(null);

        const result = await loadAnalytics(api, days, { signal: controller.signal });

        if (!shouldApplyResponse(reqId, requestIdRef.current)) return;

        setSnapshot(result);
        setLoading(false);
    }, []);

    useEffect(() => {
        load(rangeDays);
    }, [rangeDays, load]);

    // Unmounting aborts whatever is still paginating.
    useEffect(() => () => abortRef.current?.abort(), []);

    return {
        rangeDays,
        setRangeDays,
        loading,
        error: snapshot?.error ?? null,
        truncated: snapshot?.truncated ?? false,
        chatStats: snapshot?.chatStats ?? null,
        chatAggregate: snapshot?.chatAggregate ?? null,
        planStats: snapshot?.planStats ?? null,
        planAggregate: snapshot?.planAggregate ?? null,
        reload: () => load(rangeDays),
    };
}
