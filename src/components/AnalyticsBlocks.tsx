import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, fonts, spacing } from '../lib/theme';
import { RANGE_OPTIONS, type RangeDays } from '../lib/analyticsQueries';

/**
 * Presentational pieces of the Analytics screen: range chips, section
 * cards, stat tiles, and the two simple bar visualizations (single-hue
 * horizontal bars + per-day stacked bars). No data logic here — the
 * aggregation lives in `src/lib/analyticsQueries.ts`.
 */

/**
 * Series colors, assigned to sorted keys in fixed order (color follows
 * the entity, never its rank). Validated for CVD separation on the
 * white card surface; keys beyond the palette share the gray fallback —
 * every row also carries a text label + count, so color is never the
 * only identity channel.
 */
const SERIES_COLORS = [colors.electricBlue, colors.sunsetOrange, colors.successEmerald] as const;
const SERIES_FALLBACK = colors.textSecondary;

export function seriesColor(index: number): string {
    return SERIES_COLORS[index] ?? SERIES_FALLBACK;
}

// ─── Range selector ──────────────────────────────────────────────────

interface RangeSelectorProps {
    value: RangeDays;
    onChange: (days: RangeDays) => void;
}

/** 7 / 30 day chips shared by both blocks. */
export function RangeSelector({ value, onChange }: RangeSelectorProps) {
    return (
        <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map(({ days, label }) => (
                <Pressable
                    key={days}
                    style={[styles.rangeChip, value === days && styles.rangeChipActive]}
                    onPress={() => onChange(days)}
                >
                    <Text style={[styles.rangeChipText, value === days && styles.rangeChipTextActive]}>
                        {label}
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
}

export function StatCardGrid({ items }: { items: StatItem[] }) {
    return (
        <View style={styles.statGrid}>
            {items.map((item) => (
                <View key={item.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
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
export function BarList({ title, rows, emptyText }: { title: string; rows: BarRow[]; emptyText: string }) {
    const max = rows.reduce((acc, r) => Math.max(acc, r.value), 0);
    return (
        <View style={styles.chartBlock}>
            <Text style={styles.chartTitle}>{title}</Text>
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
    rows,
    seriesKeys,
    seriesTotals,
    emptyText,
}: {
    title: string;
    rows: StackedDayRow[];
    /** Sorted keys — index defines the color, stable across ranges. */
    seriesKeys: string[];
    seriesTotals: Record<string, number>;
    emptyText: string;
}) {
    const max = rows.reduce((acc, r) => Math.max(acc, r.total), 0);
    return (
        <View style={styles.chartBlock}>
            <Text style={styles.chartTitle}>{title}</Text>
            {seriesKeys.length > 0 && (
                <View style={styles.legendRow}>
                    {seriesKeys.map((key, i) => (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: seriesColor(i) }]} />
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
                            {seriesKeys.map((key, i) => {
                                const count = row.counts[key] ?? 0;
                                if (count === 0) return null;
                                return (
                                    <View
                                        key={key}
                                        style={[
                                            styles.stackSegment,
                                            { width: `${(count / max) * 100}%`, backgroundColor: seriesColor(i) },
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

const styles = StyleSheet.create({
    // Range chips
    rangeRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: 20, marginBottom: spacing.md },
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
    statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    statHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 2 },

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
