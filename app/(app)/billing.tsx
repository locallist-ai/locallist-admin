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
import { useBillingData } from '../../src/hooks/useBillingData';
import {
    BarList,
    RangeSelector,
    SectionCard,
    StatCardGrid,
    type StatItem,
} from '../../src/components/AnalyticsBlocks';
import {
    billingBreakdownRows,
    dailyToRows,
    formatCount,
    formatCurrencyAmount,
    isBillingEmpty,
    revenueByCurrencyRows,
    type AdminBillingMetrics,
} from '../../src/lib/billingQueries';
import { formatUsd } from '../../src/lib/analyticsQueries';
import { billingLegendKey, type BillingStatMetric } from '../../src/lib/billingLegend';
import { colors, fonts, spacing } from '../../src/lib/theme';

/**
 * Business/monetization dashboard (fase 2): aggregates of the
 * `billing_events` ledger from RevenueCat, read from the admin billing
 * endpoint. Data + shaping live in `useBillingData` /
 * `src/lib/billingQueries.ts`; this screen is composition only.
 *
 * Honest empty state: `billing_events` is empty until IAP goes live, so
 * the backend returns a fully zeroed DTO (HTTP 200). The screen renders
 * cleanly with zeros and a note, never an error or a blank crash.
 */
export default function BillingScreen() {
    const { t } = useTranslation();
    const { isDesktop } = useBreakpoint();
    const { rangeKey, setRangeKey, loading, error, metrics, reload } = useBillingData();

    // A stat tile: the metric value plus its legend (behind the "i" tip).
    const card = (metric: BillingStatMetric, value: string): StatItem => ({
        label: t(`billing.cards.${metric}` as 'billing.cards.totalEvents'),
        value,
        info: t(billingLegendKey(metric)),
    });

    const m: AdminBillingMetrics | null = metrics;
    const empty = isBillingEmpty(m);

    const overviewItems: StatItem[] = m ? [
        card('totalEvents', formatCount(m.totalEvents)),
        card('uniqueUsers', formatCount(m.uniqueUsers)),
        card('unresolvedEvents', formatCount(m.unresolvedEvents)),
        card('revenueUsd', formatUsd(m.revenueUsd)),
    ] : [];

    const subscriptionItems: StatItem[] = m ? [
        card('newSubscriptions', formatCount(m.newSubscriptions)),
        card('trialStarts', formatCount(m.trialStarts)),
        card('directPaidPurchases', formatCount(m.directPaidPurchases)),
        card('paidConversions', formatCount(m.paidConversions)),
        card('renewals', formatCount(m.renewals)),
        card('uncancellations', formatCount(m.uncancellations)),
    ] : [];

    const churnItems: StatItem[] = m ? [
        card('cancellations', formatCount(m.cancellations)),
        card('expirations', formatCount(m.expirations)),
        card('billingIssues', formatCount(m.billingIssues)),
        card('productChanges', formatCount(m.productChanges)),
        card('transfers', formatCount(m.transfers)),
    ] : [];

    const countRows = (record: Record<string, number> | undefined) =>
        billingBreakdownRows(record).map((r) => ({ label: r.key, value: r.count, display: String(r.count) }));

    const revenueRows = revenueByCurrencyRows(m?.revenueByCurrency).map((r) => ({
        label: r.currency, value: r.amount, display: `${r.currency} ${formatCurrencyAmount(r.amount)}`,
    }));

    const dailyRows = dailyToRows(m?.daily).map((r) => ({
        label: r.label, value: r.count, display: String(r.count),
    }));

    const emptyText = t('billing.tables.empty');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={isDesktop && styles.contentDesktop}>
                <RangeSelector value={rangeKey} onChange={setRangeKey} />

                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{t('billing.error.failed', { error })}</Text>
                        <Pressable onPress={reload} style={styles.retryBtn}>
                            <Text style={styles.retryText}>{t('billing.error.retry')}</Text>
                        </Pressable>
                    </View>
                )}

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.electricBlue} />
                    </View>
                ) : (
                    <>
                        {!error && empty && (
                            <Text style={styles.emptyNote}>{t('billing.empty.note')}</Text>
                        )}

                        <SectionCard title={t('billing.overview.title')}>
                            <StatCardGrid items={overviewItems} />
                        </SectionCard>

                        <SectionCard title={t('billing.subscriptions.title')}>
                            <StatCardGrid items={subscriptionItems} />
                        </SectionCard>

                        <SectionCard title={t('billing.churn.title')}>
                            <StatCardGrid items={churnItems} />
                        </SectionCard>

                        <SectionCard title={t('billing.breakdowns.title')}>
                            <BarList
                                title={t('billing.tables.byEventType')}
                                info={t(billingLegendKey('byEventType'))}
                                rows={countRows(m?.byEventType)}
                                emptyText={emptyText}
                            />
                            <BarList
                                title={t('billing.tables.byProductId')}
                                info={t(billingLegendKey('byProductId'))}
                                rows={countRows(m?.byProductId)}
                                emptyText={emptyText}
                            />
                            <BarList
                                title={t('billing.tables.byCountry')}
                                info={t(billingLegendKey('byCountry'))}
                                rows={countRows(m?.byCountry)}
                                emptyText={emptyText}
                            />
                            <BarList
                                title={t('billing.tables.byCancelReason')}
                                info={t(billingLegendKey('byCancelReason'))}
                                rows={countRows(m?.byCancelReason)}
                                emptyText={emptyText}
                            />
                            <BarList
                                title={t('billing.tables.revenueByCurrency')}
                                info={t(billingLegendKey('revenueByCurrency'))}
                                rows={revenueRows}
                                emptyText={emptyText}
                            />
                        </SectionCard>

                        <SectionCard title={t('billing.series.title')}>
                            <BarList
                                title={t('billing.tables.daily')}
                                info={t(billingLegendKey('daily'))}
                                rows={dailyRows}
                                emptyText={emptyText}
                            />
                        </SectionCard>
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

    emptyNote: {
        marginHorizontal: 20, marginBottom: spacing.md, padding: spacing.md,
        borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor,
        backgroundColor: colors.bgCard,
        fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary,
    },

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
});
