import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import { useAnalyticsData } from '../../src/hooks/useAnalyticsData';
import {
    BarList,
    RangeSelector,
    SectionCard,
    StackedDayBars,
    StatCardGrid,
    type StatItem,
} from '../../src/components/AnalyticsBlocks';
import {
    formatDayLabel,
    formatMs,
    formatPct,
    formatUsd,
    safeDiv,
} from '../../src/lib/analyticsQueries';
import { colors, fonts, spacing } from '../../src/lib/theme';

/**
 * Product analytics (fase 1): chat telemetry (`chat_turns`) and plan
 * generation quality (`plan_metrics`), read from the admin analytics
 * endpoints. Data + aggregation live in `useAnalyticsData` /
 * `src/lib/analyticsQueries.ts`; this screen is composition only.
 */
export default function AnalyticsScreen() {
    const { isDesktop } = useBreakpoint();
    const {
        rangeDays, setRangeDays, loading, error, truncated,
        chatStats, chatAggregate, planStats, planAggregate, reload,
    } = useAnalyticsData();

    const chatItems: StatItem[] = chatStats ? [
        { label: 'Turns', value: String(chatStats.totalTurns) },
        { label: 'Cost (range)', value: formatUsd(chatStats.totalCostUsd) },
        {
            label: 'Latency p50',
            value: chatAggregate?.latencyP50 != null ? formatMs(chatAggregate.latencyP50) : '—',
            hint: chatAggregate?.latencyP95 != null ? `p95 ${formatMs(chatAggregate.latencyP95)}` : undefined,
        },
        { label: 'Error rate', value: formatPct(chatStats.errorRate) },
        { label: 'Slot completeness (avg)', value: chatStats.totalTurns > 0 ? chatStats.avgSlotCompleteness.toFixed(1) : '—' },
    ] : [];

    const avgCostPerPlan = planStats ? safeDiv(planStats.totalCostUsd, planStats.totalPlans) : null;
    const planItems: StatItem[] = planStats ? [
        { label: 'Plans generated', value: String(planStats.totalPlans) },
        { label: 'Avg cost / plan', value: avgCostPerPlan != null ? formatUsd(avgCostPerPlan) : '—' },
        { label: 'Opened', value: planStats.totalPlans > 0 ? formatPct(planStats.openRate) : '—' },
        { label: 'Followed', value: planStats.totalPlans > 0 ? formatPct(planStats.followRate) : '—' },
    ] : [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={isDesktop && styles.contentDesktop}>
                <RangeSelector value={rangeDays} onChange={setRangeDays} />

                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>Failed to load analytics: {error}</Text>
                        <Pressable onPress={reload} style={styles.retryBtn}>
                            <Text style={styles.retryText}>Retry</Text>
                        </Pressable>
                    </View>
                )}

                {truncated && (
                    <Text style={styles.truncatedNote}>
                        Large range: daily series, percentiles and mixes are computed on a sample
                        (first 2000 rows); the summary cards remain exact.
                    </Text>
                )}

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.electricBlue} />
                    </View>
                ) : (
                    <>
                        <SectionCard title="Chat">
                            <StatCardGrid items={chatItems} />
                            <BarList
                                title="Turns / day"
                                rows={(chatAggregate?.turnsPerDay ?? []).map((b) => ({
                                    label: formatDayLabel(b.day), value: b.total, display: String(b.total),
                                }))}
                                emptyText="No chat turns in this range."
                            />
                            <BarList
                                title="Provider · model"
                                rows={(chatAggregate?.providerModelMix ?? []).map((m) => ({
                                    label: m.key, value: m.count, display: `${m.count} · ${formatPct(m.share)}`,
                                }))}
                                emptyText="No chat turns in this range."
                            />
                        </SectionCard>

                        <SectionCard title="Plans">
                            <StatCardGrid items={planItems} />
                            <StackedDayBars
                                title="Plans / day by source"
                                rows={(planAggregate?.plansPerDayBySource ?? []).map((b) => ({
                                    label: formatDayLabel(b.day), counts: b.counts, total: b.total,
                                }))}
                                seriesKeys={planAggregate?.sources ?? []}
                                seriesTotals={Object.fromEntries(
                                    (planAggregate?.sourceMix ?? []).map((m) => [m.key, m.count]),
                                )}
                                emptyText="No plans generated in this range."
                            />
                        </SectionCard>

                        {/*
                          EXTENSION POINT (fase 2 — monetización, APLAZADA):
                          añadir aquí un <SectionCard title="Billing"> con los
                          agregados de billing_events cuando el backend exponga
                          /admin/billing/metrics. El fetch correspondiente se
                          engancha en useAnalyticsData (ver comentario allí).
                        */}
                    </>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgMain },
    scrollContent: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
    contentDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },

    loadingBox: { paddingVertical: spacing.xxl, alignItems: 'center' },

    errorBanner: {
        marginHorizontal: 20, marginBottom: spacing.md, padding: spacing.md,
        borderRadius: 12, borderWidth: 1, borderColor: colors.error,
        backgroundColor: colors.bgCard,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    },
    errorText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.error },
    retryBtn: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: 8, borderWidth: 1, borderColor: colors.error,
    },
    retryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.error },

    truncatedNote: {
        marginHorizontal: 20, marginBottom: spacing.md,
        fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary,
    },
});
