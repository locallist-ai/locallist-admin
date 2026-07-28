/**
 * Pure mapping metric -> i18n legend key for the Billing screen. Every
 * stat tile and breakdown table shows a one-line "what it measures and
 * why it matters" note behind an "i" affordance; the copy lives in the
 * i18n resources under `billing.legend.*`. Keeping the mapping here (not
 * inline in the screen) lets a vitest check that every metric has a
 * legend key AND that the key exists in both en.ts and es.ts.
 *
 * Same shape as `analyticsLegend.ts`: two ordered metric lists, one
 * `legendKey` helper typed to the template-literal key union.
 */

/** Stat-tile metrics, in display order (Overview + Subscriptions + Churn). */
export const BILLING_STAT_METRICS = [
  'totalEvents',
  'uniqueUsers',
  'unresolvedEvents',
  'revenueUsd',
  'newSubscriptions',
  'trialStarts',
  'directPaidPurchases',
  'paidConversions',
  'renewals',
  'uncancellations',
  'cancellations',
  'expirations',
  'billingIssues',
  'productChanges',
  'transfers',
] as const;

/** Breakdown-table + daily-series metrics, in display order. */
export const BILLING_BREAKDOWN_METRICS = [
  'byEventType',
  'byProductId',
  'byCountry',
  'byCancelReason',
  'revenueByCurrency',
  'daily',
] as const;

export type BillingStatMetric = (typeof BILLING_STAT_METRICS)[number];
export type BillingBreakdownMetric = (typeof BILLING_BREAKDOWN_METRICS)[number];
export type BillingMetric = BillingStatMetric | BillingBreakdownMetric;

/**
 * i18n key of the legend line for a metric (under `billing.legend`).
 * Typed as the template-literal key union so the strict `t()` accepts it.
 */
export function billingLegendKey(metric: BillingMetric): `billing.legend.${BillingMetric}` {
  return `billing.legend.${metric}`;
}
