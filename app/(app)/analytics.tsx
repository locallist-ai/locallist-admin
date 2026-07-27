import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import { useAnalyticsData } from '../../src/hooks/useAnalyticsData';
import {
    BarList,
    CityStatsTable,
    RangeSelector,
    SectionCard,
    StackedDayBars,
    StatCardGrid,
    type StatItem,
} from '../../src/components/AnalyticsBlocks';
import {
    ANALYTICS_MAX_PAGES,
    ANALYTICS_PAGE_LIMIT,
    breakdownToRows,
    formatMs,
    formatPct,
    formatPeriodLabel,
    formatUsd,
    safeDiv,
    sortCityStats,
} from '../../src/lib/analyticsQueries';
import { legendKey } from '../../src/lib/analyticsLegend';
import { colors, fonts, spacing } from '../../src/lib/theme';

/**
 * Product analytics (fase 1): chat telemetry (`chat_turns`) and plan
 * generation quality (`plan_metrics`), read from the admin analytics
 * endpoints. Data + aggregation live in `useAnalyticsData` /
 * `src/lib/analyticsQueries.ts`; this screen is composition only.
 */
export default function AnalyticsScreen() {
    const { t } = useTranslation();
    const { isDesktop } = useBreakpoint();
    const {
        rangeKey, setRangeKey, granularity, loading, error, truncated,
        chatStats, chatAggregate, planStats, planAggregate, reload,
    } = useAnalyticsData();

    // Single empty-state criterion: with no rows in the range, every tile
    // derived from an empty count renders an em dash (the backend returns
    // 0 there, which would read as a real measurement).
    const hasTurns = (chatStats?.totalTurns ?? 0) > 0;
    const chatItems: StatItem[] = chatStats ? [
        { label: t('analytics.chat.turns'), value: String(chatStats.totalTurns), info: t(legendKey('turns')) },
        { label: t('analytics.chat.cost'), value: hasTurns ? formatUsd(chatStats.totalCostUsd) : '—', info: t(legendKey('cost')) },
        {
            label: t('analytics.chat.latencyP50'),
            value: chatAggregate?.latencyP50 != null ? formatMs(chatAggregate.latencyP50) : '—',
            hint: chatAggregate?.latencyP95 != null ? t('analytics.chat.latencyP95Hint', { value: formatMs(chatAggregate.latencyP95) }) : undefined,
            info: t(legendKey('latency')),
        },
        { label: t('analytics.chat.errorRate'), value: hasTurns ? formatPct(chatStats.errorRate) : '—', info: t(legendKey('errorRate')) },
        { label: t('analytics.chat.slotCompleteness'), value: hasTurns ? chatStats.avgSlotCompleteness.toFixed(1) : '—', info: t(legendKey('slotCompleteness')) },
    ] : [];

    const finishReasonRows = breakdownToRows(chatStats?.finishReasonBreakdown).map((r) => ({
        label: r.key, value: r.count, display: String(r.count),
    }));
    const errorCodeRows = breakdownToRows(chatStats?.errorCodeBreakdown).map((r) => ({
        label: r.key, value: r.count, display: String(r.count),
    }));

    const avgCostPerPlan = planStats ? safeDiv(planStats.totalCostUsd, planStats.totalPlans) : null;
    const planItems: StatItem[] = planStats ? [
        { label: t('analytics.plans.generated'), value: String(planStats.totalPlans), info: t(legendKey('plansGenerated')) },
        { label: t('analytics.plans.avgCost'), value: avgCostPerPlan != null ? formatUsd(avgCostPerPlan) : '—', info: t(legendKey('avgCost')) },
        { label: t('analytics.plans.opened'), value: planStats.totalPlans > 0 ? formatPct(planStats.openRate) : '—', info: t(legendKey('opened')) },
        { label: t('analytics.plans.followed'), value: planStats.totalPlans > 0 ? formatPct(planStats.followRate) : '—', info: t(legendKey('followed')) },
    ] : [];

    const cityRows = sortCityStats(planStats?.byCity).map((c) => ({
        city: c.city,
        count: String(c.count),
        open: formatPct(c.openRate),
        follow: formatPct(c.followRate),
    }));

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={isDesktop && styles.contentDesktop}>
                <RangeSelector value={rangeKey} onChange={setRangeKey} />

                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{t('analytics.error.failed', { error })}</Text>
                        <Pressable onPress={reload} style={styles.retryBtn}>
                            <Text style={styles.retryText}>{t('analytics.error.retry')}</Text>
                        </Pressable>
                    </View>
                )}

                {truncated && (
                    <Text style={styles.truncatedNote}>
                        {t('analytics.truncated', { rows: String(ANALYTICS_MAX_PAGES * ANALYTICS_PAGE_LIMIT) })}
                    </Text>
                )}

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.electricBlue} />
                    </View>
                ) : (
                    <>
                        <SectionCard title={t('analytics.chat.title')}>
                            <StatCardGrid items={chatItems} />
                            <BarList
                                title={t('analytics.chat.turnsPerPeriod')}
                                info={t(legendKey('turnsPerPeriod'))}
                                rows={(chatAggregate?.turnsPerPeriod ?? []).map((b) => ({
                                    label: formatPeriodLabel(b.key, granularity), value: b.total, display: String(b.total),
                                }))}
                                emptyText={t('analytics.chat.empty')}
                            />
                            <BarList
                                title={t('analytics.chat.providerModel')}
                                info={t(legendKey('providerModel'))}
                                rows={(chatAggregate?.providerModelMix ?? []).map((m) => ({
                                    label: m.key, value: m.count, display: `${m.count} · ${formatPct(m.share)}`,
                                }))}
                                emptyText={t('analytics.chat.empty')}
                            />
                            <BarList
                                title={t('analytics.chat.finishReasons')}
                                info={t(legendKey('finishReasons'))}
                                rows={finishReasonRows}
                                emptyText={t('analytics.chat.empty')}
                            />
                            <BarList
                                title={t('analytics.chat.errorCodes')}
                                info={t(legendKey('errorCodes'))}
                                rows={errorCodeRows}
                                emptyText={t('analytics.chat.empty')}
                            />
                        </SectionCard>

                        <SectionCard title={t('analytics.plans.title')}>
                            <StatCardGrid items={planItems} />
                            <StackedDayBars
                                title={t('analytics.plans.plansBySource')}
                                info={t(legendKey('plansBySource'))}
                                rows={(planAggregate?.plansPerPeriodBySource ?? []).map((b) => ({
                                    label: formatPeriodLabel(b.key, granularity), counts: b.counts, total: b.total,
                                }))}
                                seriesKeys={planAggregate?.sources ?? []}
                                seriesTotals={Object.fromEntries(
                                    (planAggregate?.sourceMix ?? []).map((m) => [m.key, m.count]),
                                )}
                                emptyText={t('analytics.plans.empty')}
                            />
                            <CityStatsTable
                                title={t('analytics.plans.byCity')}
                                info={t(legendKey('byCity'))}
                                rows={cityRows}
                                emptyText={t('analytics.cityTable.empty')}
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
