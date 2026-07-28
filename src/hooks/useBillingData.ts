import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { shouldApplyResponse } from '../lib/raceGuard';
import { type RangeKey } from '../lib/analyticsQueries';
import { loadBilling, type BillingSnapshot } from '../lib/billingQueries';

/**
 * Data side of the Billing screen: thin React wiring over `loadBilling`
 * (src/lib/billingQueries.ts), which owns the single admin request and
 * never rejects. Mirrors `useAnalyticsData`: one AbortController per load
 * (range toggle, retry, unmount aborts the previous so a superseded load
 * does not burn the shared admin rate limit) plus a monotonic request-id
 * guard on top (an aborted load still resolves).
 */
export function useBillingData() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (key: RangeKey) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const reqId = ++requestIdRef.current;
    setLoading(true);
    // The previous range's data and error must not linger under the new
    // range's spinner.
    setSnapshot(null);

    const result = await loadBilling(api, key, { signal: controller.signal });

    if (!shouldApplyResponse(reqId, requestIdRef.current)) return;

    setSnapshot(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(rangeKey);
  }, [rangeKey, load]);

  // Unmounting aborts whatever request is still in flight.
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    rangeKey,
    setRangeKey,
    loading,
    error: snapshot?.error ?? null,
    metrics: snapshot?.metrics ?? null,
    reload: () => load(rangeKey),
  };
}
