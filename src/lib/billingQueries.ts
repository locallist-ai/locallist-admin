/**
 * Pure logic behind the Billing screen (app/(app)/billing.tsx): the DTO
 * of the admin billing-metrics endpoint, its query builder, the single
 * load orchestration, and the row-shaping helpers for the breakdown
 * tables and the daily series. Extracted so it is unit-testable in
 * vitest (native modules do not resolve in Node).
 *
 * Backend contract (locallist-api-net, Features/Admin/Billing):
 * - GET /admin/billing/metrics ?from&to   (FirebaseScheme admin auth)
 *
 * The endpoint aggregates the `billing_events` ledger entirely in SQL and
 * is EMPTY-SAFE: with zero rows in range it returns a fully zeroed DTO
 * (all counts 0, dictionaries and daily[] empty) at HTTP 200, never an
 * error. `billing_events` stays empty until IAP goes live, so that zeroed
 * shape is the normal pre-launch state, not a failure (see `isBillingEmpty`).
 *
 * Range handling is shared with the Analytics screen (same preset chips,
 * same UTC-midnight bounds, same all-time = omit `from` rule) by reusing
 * `RangeKey` / `rangeForKey` from `analyticsQueries.ts`. Revenue is GROSS
 * charge revenue (refunds not netted); `revenueByCurrency` is kept per
 * currency and never summed across currencies (mirrors the backend).
 *
 * Wire-format note: the endpoint returns every field on both the empty
 * and the populated path (empty dictionaries/list, not null), but the
 * shaping helpers below still guard against absent collections so a lax
 * serializer change can never crash the screen.
 */
import {
  breakdownToRows,
  formatDayLabel,
  rangeForKey,
  type AnalyticsRange,
  type ApiCall,
  type BreakdownRow,
  type RangeKey,
} from './analyticsQueries';

// ─── Backend DTO (camelCase over the wire) ───────────────────────────

/** One point of the daily series: a UTC calendar day and its event count. */
export interface AdminBillingDailyPoint {
  /** ISO date 'YYYY-MM-DD' (backend serializes DateOnly this way). */
  date: string;
  count: number;
}

export interface AdminBillingMetrics {
  totalEvents: number;
  newSubscriptions: number;
  trialStarts: number;
  directPaidPurchases: number;
  paidConversions: number;
  renewals: number;
  cancellations: number;
  uncancellations: number;
  expirations: number;
  billingIssues: number;
  productChanges: number;
  transfers: number;
  unresolvedEvents: number;
  uniqueUsers: number;
  /** GROSS charge revenue, RC USD-normalized. Refunds NOT netted. */
  revenueUsd: number;
  byEventType: Record<string, number>;
  byProductId: Record<string, number>;
  byCountry: Record<string, number>;
  byCancelReason: Record<string, number>;
  /** Per currency, buyer-currency amounts. NEVER summed across currencies. */
  revenueByCurrency: Record<string, number>;
  daily: AdminBillingDailyPoint[];
}

// ─── Query builder ───────────────────────────────────────────────────

/**
 * `/admin/billing/metrics` for a range. All-time (`from == null`) omits
 * `from` entirely, matching the backend "missing lower bound = since the
 * beginning" contract (same rule the analytics builders use).
 */
export function buildBillingMetricsQuery(range: AnalyticsRange): string {
  const params = new URLSearchParams();
  if (range.from != null) params.set('from', range.from);
  params.set('to', range.to);
  return `/admin/billing/metrics?${params}`;
}

// ─── Row shaping ─────────────────────────────────────────────────────

/**
 * A count dictionary (byEventType/byProductId/byCountry/byCancelReason)
 * as ordered rows: highest count first, ties broken alphabetically.
 * Absent/empty dictionary yields an empty list. Reuses the analytics
 * `breakdownToRows` so ordering is identical across both screens.
 */
export function billingBreakdownRows(record: Record<string, number> | undefined | null): BreakdownRow[] {
  return breakdownToRows(record);
}

export interface RevenueRow {
  currency: string;
  amount: number;
}

/** Revenue per currency ordered by amount desc, then currency code asc. */
export function revenueByCurrencyRows(record: Record<string, number> | undefined | null): RevenueRow[] {
  if (!record) return [];
  return Object.entries(record)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));
}

export interface DailyRow {
  /** Axis label, e.g. '28 Jul'. */
  label: string;
  count: number;
}

/**
 * The daily series as axis-labelled rows. The backend already returns it
 * ordered by day ascending, so order is preserved. Absent list = empty.
 */
export function dailyToRows(daily: AdminBillingDailyPoint[] | undefined | null): DailyRow[] {
  if (!daily) return [];
  return daily.map((p) => ({ label: formatDayLabel(p.date), count: p.count }));
}

/**
 * True when there is no billing activity in range. This is the normal
 * pre-IAP state (the ledger is empty), so the screen shows an honest
 * "no events yet" note with zeros rather than an error or a blank.
 */
export function isBillingEmpty(metrics: AdminBillingMetrics | null): boolean {
  return (metrics?.totalEvents ?? 0) === 0;
}

// ─── Load orchestration ──────────────────────────────────────────────

export interface BillingSnapshot {
  metrics: AdminBillingMetrics | null;
  aborted: boolean;
  error: string | null;
}

/**
 * One load for a range: a single GET against the billing-metrics
 * endpoint (all aggregation is server-side, so there is nothing to
 * paginate or aggregate client-side). Never rejects: any throw becomes
 * an error snapshot so the UI always leaves the loading state.
 */
export async function loadBilling(
  apiCall: ApiCall,
  rangeKey: RangeKey,
  { now = new Date(), signal }: { now?: Date; signal?: AbortSignal } = {},
): Promise<BillingSnapshot> {
  const range = rangeForKey(rangeKey, now);
  try {
    const res = await apiCall<AdminBillingMetrics>(buildBillingMetricsQuery(range), { signal });
    return { metrics: res.data, aborted: signal?.aborted ?? false, error: res.error };
  } catch (err) {
    return {
      metrics: null,
      aborted: signal?.aborted ?? false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    };
  }
}

// ─── Display formatters ──────────────────────────────────────────────

/** Whole-number metric count as a string (no thousands grouping yet). */
export function formatCount(value: number): string {
  return String(value);
}

/** A localized currency amount (2 decimals). The code is shown separately. */
export function formatCurrencyAmount(value: number): string {
  return value.toFixed(2);
}
