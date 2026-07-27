import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, colors, fonts, spacing } from '../lib/theme';
import { RANGE_OPTIONS, type RangeKey } from '../lib/analyticsQueries';

/**
 * Presentational pieces of the Analytics screen: range chips, section
 * cards, stat tiles, and the two simple bar visualizations (single-hue
 * horizontal bars + per-day stacked bars). No data logic here — the
 * aggregation lives in `src/lib/analyticsQueries.ts`.
 */

/**
 * Series colors keyed by ENTITY, not by position: known generation
 * sources have a fixed color (stable across range changes and across
 * whatever subset the current range contains), and unknown keys hash
 * deterministically into the palette — same key, same color, always.
 * Two unknown keys may collide, but every legend item and row carries
 * a text label + count, so color is never the only identity channel.
 * Palette validated for CVD separation on the white card surface.
 */
const SERIES_COLORS = [colors.electricBlue, colors.sunsetOrange, colors.successEmerald] as const;

/** Values written by the backend today (ChatController / BuilderController). */
const KNOWN_SOURCE_COLORS: Record<string, string> = {
    chat: colors.electricBlue,
    builder: colors.sunsetOrange,
};

export function seriesColor(key: string): string {
    const known = KNOWN_SOURCE_COLORS[key];
    if (known) return known;
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return SERIES_COLORS[hash % SERIES_COLORS.length];
}

// ─── Legend ("i" tooltip) ────────────────────────────────────────────

/**
 * "i" affordance next to a metric title/tile. Opens a small modal with a
 * one-line explanation of what the metric measures and why it matters
 * (RN-web tooltips are unreliable, so a tap-to-open modal is the fallback
 * per the design). `title`/`body` arrive already translated by the caller.
 */
export function InfoTip({ title, body }: { title: string; body: string }) {
    const { t } = useTranslation();
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                hitSlop={8}
                style={styles.infoBtn}
                accessibilityRole="button"
                accessibilityLabel={t('analytics.legend.a11y', { metric: title })}
            >
                <Text style={styles.infoBtnText}>i</Text>
            </Pressable>
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.infoOverlay} onPress={() => setOpen(false)}>
                    <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.infoTitle}>{title}</Text>
                        <Text style={styles.infoBody}>{body}</Text>
                        <Pressable onPress={() => setOpen(false)} style={styles.infoClose}>
                            <Text style={styles.infoCloseText}>{t('common.close')}</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

/** Chart/section title with an optional "i" legend tip beside it. */
function TitleWithInfo({ title, info, style }: { title: string; info?: string; style: object }) {
    return (
        <View style={styles.titleRow}>
            <Text style={style}>{title}</Text>
            {info ? <InfoTip title={title} body={info} /> : null}
        </View>
    );
}

// ─── Range selector ──────────────────────────────────────────────────

interface RangeSelectorProps {
    value: RangeKey;
    onChange: (key: RangeKey) => void;
}

/** 7d / 30d / 90d / 1y / All chips shared by both blocks (labels i18n'd). */
export function RangeSelector({ value, onChange }: RangeSelectorProps) {
    const { t } = useTranslation();
    return (
        <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map(({ key }) => (
                <Pressable
                    key={key}
                    style={[styles.rangeChip, value === key && styles.rangeChipActive]}
                    onPress={() => onChange(key)}
                >
                    <Text style={[styles.rangeChipText, value === key && styles.rangeChipTextActive]}>
                        {t(`analytics.ranges.${key}` as 'analytics.ranges.all')}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

// ─── Section + stat cards ────────────────────────────────────────────

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

export interface StatItem {
    label: string;
    value: string;
    /** Optional secondary line under the value (e.g. "p95 2.1s"). */
    hint?: string;
    /** Optional legend line ("what it measures"), shown behind an "i" tip. */
    info?: string;
}

export function StatCardGrid({ items }: { items: StatItem[] }) {
    return (
        <View style={styles.statGrid}>
            {items.map((item) => (
                <View key={item.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{item.value}</Text>
                    <View style={styles.statLabelRow}>
                        <Text style={styles.statLabel}>{item.label}</Text>
                        {item.info ? <InfoTip title={item.label} body={item.info} /> : null}
                    </View>
                    {item.hint ? <Text style={styles.statHint}>{item.hint}</Text> : null}
                </View>
            ))}
        </View>
    );
}

// ─── Bars ────────────────────────────────────────────────────────────

export interface BarRow {
    label: string;
    value: number;
    /** Text shown at the right end of the row (count, share…). */
    display: string;
}

/**
 * Label + thin single-hue bar + value, scaled to the max row. Used for
 * turns/day and the provider · model mix.
 */
export function BarList({ title, info, rows, emptyText }: { title: string; info?: string; rows: BarRow[]; emptyText: string }) {
    const max = rows.reduce((acc, r) => Math.max(acc, r.value), 0);
    return (
        <View style={styles.chartBlock}>
            <TitleWithInfo title={title} info={info} style={styles.chartTitle} />
            {rows.length === 0 || max === 0 ? (
                <Text style={styles.emptyText}>{emptyText}</Text>
            ) : (
                rows.map((row) => (
                    <View key={row.label} style={styles.barRow}>
                        <Text style={styles.barLabel} numberOfLines={1}>{row.label}</Text>
                        <View style={styles.barTrack}>
                            <View
                                style={[
                                    styles.barFill,
                                    { width: `${(row.value / max) * 100}%` },
                                    row.value === 0 && styles.barFillEmpty,
                                ]}
                            />
                        </View>
                        <Text style={styles.barValue}>{row.display}</Text>
                    </View>
                ))
            )}
        </View>
    );
}

export interface StackedDayRow {
    label: string;
    counts: Record<string, number>;
    total: number;
}

/**
 * Per-day horizontal stacked bars, one segment per series key, with a
 * legend (color dot + name + count). 2px gaps keep segments readable.
 */
export function StackedDayBars({
    title,
    info,
    rows,
    seriesKeys,
    seriesTotals,
    emptyText,
}: {
    title: string;
    info?: string;
    rows: StackedDayRow[];
    /** Sorted keys (display order only — color comes from `seriesColor(key)`). */
    seriesKeys: string[];
    seriesTotals: Record<string, number>;
    emptyText: string;
}) {
    const max = rows.reduce((acc, r) => Math.max(acc, r.total), 0);
    return (
        <View style={styles.chartBlock}>
            <TitleWithInfo title={title} info={info} style={styles.chartTitle} />
            {seriesKeys.length > 0 && (
                <View style={styles.legendRow}>
                    {seriesKeys.map((key) => (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: seriesColor(key) }]} />
                            <Text style={styles.legendText}>{key} · {seriesTotals[key] ?? 0}</Text>
                        </View>
                    ))}
                </View>
            )}
            {rows.length === 0 || max === 0 ? (
                <Text style={styles.emptyText}>{emptyText}</Text>
            ) : (
                rows.map((row) => (
                    <View key={row.label} style={styles.barRow}>
                        <Text style={styles.barLabel} numberOfLines={1}>{row.label}</Text>
                        <View style={styles.barTrack}>
                            {seriesKeys.map((key) => {
                                const count = row.counts[key] ?? 0;
                                if (count === 0) return null;
                                return (
                                    <View
                                        key={key}
                                        style={[
                                            styles.stackSegment,
                                            { width: `${(count / max) * 100}%`, backgroundColor: seriesColor(key) },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                        <Text style={styles.barValue}>{row.total}</Text>
                    </View>
                ))
            )}
        </View>
    );
}

// ─── Per-city table ──────────────────────────────────────────────────

export interface CityStatRow {
    city: string;
    count: string;
    /** Open rate, preformatted (e.g. "42%"). */
    open: string;
    /** Follow rate, preformatted. */
    follow: string;
}

/**
 * Compact per-city table (City / Plans / Opened / Followed) fed by the
 * `byCity` distribution the plan-metrics /stats endpoint already returns.
 * Presentational: rows arrive preformatted, headers are i18n'd here.
 */
export function CityStatsTable({
    title,
    info,
    rows,
    emptyText,
}: {
    title: string;
    info?: string;
    rows: CityStatRow[];
    emptyText: string;
}) {
    const { t } = useTranslation();
    return (
        <View style={styles.chartBlock}>
            <TitleWithInfo title={title} info={info} style={styles.chartTitle} />
            {rows.length === 0 ? (
                <Text style={styles.emptyText}>{emptyText}</Text>
            ) : (
                <>
                    <View style={[styles.cityRow, styles.cityHeaderRow]}>
                        <Text style={[styles.cityCell, styles.cityNameCell, styles.cityHeaderText]} numberOfLines={1}>
                            {t('analytics.cityTable.city')}
                        </Text>
                        <Text style={[styles.cityCell, styles.cityHeaderText]}>{t('analytics.cityTable.count')}</Text>
                        <Text style={[styles.cityCell, styles.cityHeaderText]}>{t('analytics.cityTable.opened')}</Text>
                        <Text style={[styles.cityCell, styles.cityHeaderText]}>{t('analytics.cityTable.followed')}</Text>
                    </View>
                    {rows.map((row) => (
                        <View key={row.city} style={styles.cityRow}>
                            <Text style={[styles.cityCell, styles.cityNameCell, styles.cityNameText]} numberOfLines={1}>
                                {row.city}
                            </Text>
                            <Text style={[styles.cityCell, styles.cityValueText]}>{row.count}</Text>
                            <Text style={[styles.cityCell, styles.cityValueText]}>{row.open}</Text>
                            <Text style={[styles.cityCell, styles.cityValueText]}>{row.follow}</Text>
                        </View>
                    ))}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Range chips
    rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: 20, marginBottom: spacing.md },
    rangeChip: {
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1, borderColor: colors.borderColor,
        backgroundColor: colors.bgCard,
    },
    rangeChipActive: { backgroundColor: colors.deepOcean, borderColor: colors.deepOcean },
    rangeChipText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
    rangeChipTextActive: { color: '#fff' },

    // Section card
    sectionCard: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.lg,
        padding: spacing.md, marginHorizontal: 20, marginBottom: spacing.md,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    sectionTitle: {
        fontFamily: fonts.headingSemiBold, fontSize: 20, color: colors.deepOcean,
        marginBottom: spacing.md,
    },

    // Stat tiles
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    statCard: {
        flexGrow: 1, flexBasis: '30%', minWidth: 96,
        backgroundColor: colors.bgMain, borderRadius: borderRadius.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
    statValue: { fontFamily: fonts.bodySemiBold, fontSize: 20, color: colors.textMain },
    statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    statHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 2 },

    // Legend "i" tip
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    infoBtn: {
        width: 16, height: 16, borderRadius: 8,
        borderWidth: 1, borderColor: colors.textSecondary,
        alignItems: 'center', justifyContent: 'center',
    },
    infoBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 10, lineHeight: 12, color: colors.textSecondary },
    infoOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
    },
    infoCard: {
        backgroundColor: colors.bgMain, borderRadius: borderRadius.lg,
        padding: spacing.lg, maxWidth: 360, width: '100%', gap: spacing.sm,
    },
    infoTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.deepOcean },
    infoBody: { fontFamily: fonts.body, fontSize: 14, color: colors.textMain, lineHeight: 20 },
    infoClose: {
        alignSelf: 'flex-end', marginTop: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.borderColor,
    },
    infoCloseText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textMain },

    // Per-city table
    cityRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderColor,
    },
    cityHeaderRow: { borderBottomWidth: 0 },
    cityCell: { width: 56, textAlign: 'right', fontFamily: fonts.body, fontSize: 12 },
    cityNameCell: { flex: 1, textAlign: 'left', width: undefined },
    cityHeaderText: { color: colors.textSecondary, fontFamily: fonts.bodySemiBold },
    cityNameText: { color: colors.textMain },
    cityValueText: { color: colors.textMain, fontFamily: fonts.bodySemiBold },

    // Charts
    chartBlock: { marginBottom: spacing.sm },
    chartTitle: {
        fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textMain,
        marginBottom: spacing.sm,
    },
    emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },

    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
    barLabel: { width: 110, fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    barTrack: {
        flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgMain,
        flexDirection: 'row', gap: 2, overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: colors.electricBlue },
    barFillEmpty: { backgroundColor: 'transparent' },
    barValue: {
        minWidth: 44, textAlign: 'right',
        fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.textMain,
    },
    stackSegment: { height: 8, borderRadius: 4 },

    // Legend
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
