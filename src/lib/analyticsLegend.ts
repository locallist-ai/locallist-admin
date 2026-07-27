/**
 * Pure mapping metric -> i18n legend key for the Analytics screen. Each
 * dashboard tile / chart shows a one-line "what it measures and why it
 * matters" note behind an "i" affordance; the copy lives in the i18n
 * resources under `analytics.legend.*`. Keeping the mapping here (instead
 * of inline in the screen) lets a vitest check that every metric has a
 * legend key AND that the key exists in both en.ts and es.ts.
 */

/** Chat block metrics, in display order. */
export const CHAT_METRICS = [
  'turns',
  'cost',
  'latency',
  'errorRate',
  'slotCompleteness',
  'turnsPerPeriod',
  'providerModel',
  'finishReasons',
  'errorCodes',
] as const;

/** Plans block metrics, in display order. */
export const PLAN_METRICS = [
  'plansGenerated',
  'avgCost',
  'opened',
  'followed',
  'plansBySource',
  'byCity',
] as const;

export type ChatMetric = (typeof CHAT_METRICS)[number];
export type PlanMetric = (typeof PLAN_METRICS)[number];
export type AnalyticsMetric = ChatMetric | PlanMetric;

/**
 * i18n key of the legend line for a metric (under `analytics.legend`).
 * Typed as the template-literal key union so the strict `t()` accepts it.
 */
export function legendKey(metric: AnalyticsMetric): `analytics.legend.${AnalyticsMetric}` {
  return `analytics.legend.${metric}`;
}
