import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../../src/lib/dialogs';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/lib/api';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';

interface DryRunResult {
    candidates: number;
    wouldFetchGoogle: number;
    wouldFallbackGemini: number;
    dryRun: true;
}

interface RunResult {
    candidates: number;
    googleFilled: number;
    geminiFilled: number;
    failed: number;
    dryRun: false;
}

type Result = DryRunResult | RunResult;

export default function BackfillDescriptionsScreen() {
    const { t } = useTranslation();
    const [limit, setLimit] = useState('200');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const handleDryRun = async () => {
        setLoading(true);
        setResult(null);
        const res = await api<DryRunResult>(
            `/admin/places/backfill-descriptions?dryRun=true&limit=${parsedLimit}`,
            { method: 'POST' },
        );
        setLoading(false);
        if (res.data) {
            setResult(res.data);
        } else {
            showAlert(t('common.error'), res.error ?? t('backfill.requestFailed'));
        }
    };

    const handleRun = () => {
        showAlert(
            t('backfill.runBackfill'),
            t('backfill.runMsg', { count: parsedLimit }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('backfill.run'), style: 'destructive', onPress: runBackfill },
            ],
        );
    };

    const runBackfill = async () => {
        setLoading(true);
        setResult(null);
        const res = await api<RunResult>(
            `/admin/places/backfill-descriptions?dryRun=false&limit=${parsedLimit}`,
            { method: 'POST', timeoutMs: 120_000 },
        );
        setLoading(false);
        if (res.data) {
            setResult(res.data);
        } else {
            showAlert(t('common.error'), res.error ?? t('backfill.requestFailed'));
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: t('dashboard.backfillDescriptions'),
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                <Text style={styles.sectionTitle}>{t('backfill.howItWorks')}</Text>
                <View style={styles.section}>
                    <Text style={styles.bodyText}>
                        {t('backfill.howItWorksBody')}
                    </Text>
                    <Text style={[styles.bodyText, styles.bodyTextMuted]}>
                        {t('backfill.howItWorksNote')}
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>{t('backfill.options')}</Text>
                <View style={styles.section}>
                    <Text style={styles.fieldLabel}>{t('backfill.limitLabel')}</Text>
                    <TextInput
                        style={styles.input}
                        value={limit}
                        onChangeText={setLimit}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <View style={styles.btnRow}>
                    <Pressable
                        style={[styles.dryRunBtn, loading && styles.btnDisabled]}
                        onPress={handleDryRun}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color={colors.electricBlue} size="small" />
                            : <Text style={styles.dryRunBtnText}>{t('backfill.dryRun')}</Text>
                        }
                    </Pressable>
                    <Pressable
                        style={[styles.runBtn, loading && styles.btnDisabled]}
                        onPress={handleRun}
                        disabled={loading}
                    >
                        <Text style={styles.runBtnText}>{t('backfill.runBackfill')}</Text>
                    </Pressable>
                </View>

                {result && (
                    <>
                        <Text style={styles.sectionTitle}>{t('backfill.result')}</Text>
                        <View style={styles.resultBox}>
                            <ResultRow label={t('backfill.candidates')} value={result.candidates} />
                            {result.dryRun ? (
                                <>
                                    <ResultRow label={t('backfill.wouldFetchGoogle')} value={(result as DryRunResult).wouldFetchGoogle} color={colors.successEmerald} />
                                    <ResultRow label={t('backfill.wouldFallbackGemini')} value={(result as DryRunResult).wouldFallbackGemini} color={colors.electricBlue} />
                                    <Text style={styles.dryRunNote}>{t('backfill.dryRunNote')}</Text>
                                </>
                            ) : (
                                <>
                                    <ResultRow label={t('backfill.filledGoogle')} value={(result as RunResult).googleFilled} color={colors.successEmerald} />
                                    <ResultRow label={t('backfill.filledGemini')} value={(result as RunResult).geminiFilled} color={colors.electricBlue} />
                                    <ResultRow label={t('backfill.failedNoSource')} value={(result as RunResult).failed} color={colors.error} />
                                </>
                            )}
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

function ResultRow({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>{label}</Text>
            <Text style={[styles.resultValue, color ? { color } : null]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgMain },
    content: { padding: 20, maxWidth: 640, alignSelf: 'center', width: '100%' },
    sectionTitle: {
        fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.electricBlue,
        textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm,
    },
    section: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.borderColor,
    },
    bodyText: { fontSize: 14, fontFamily: fonts.body, color: colors.textMain, lineHeight: 20 },
    bodyTextMuted: { color: colors.textSecondary, marginTop: spacing.sm },
    fieldLabel: {
        fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textSecondary,
        marginBottom: 6,
    },
    input: {
        backgroundColor: colors.bgMain, borderRadius: borderRadius.sm, padding: spacing.md,
        color: colors.textMain, fontFamily: fonts.body, fontSize: 15,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    dryRunBtn: {
        flex: 1, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.electricBlue,
        paddingVertical: spacing.md, alignItems: 'center',
    },
    runBtn: {
        flex: 1, borderRadius: borderRadius.md, backgroundColor: colors.successEmerald,
        paddingVertical: spacing.md, alignItems: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    dryRunBtnText: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.electricBlue },
    runBtnText: { fontSize: 15, fontFamily: fonts.bodyBold, color: '#fff' },
    resultBox: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.borderColor,
    },
    resultRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderColor,
    },
    resultLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.textMain },
    resultValue: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.textMain },
    dryRunNote: {
        fontSize: 12, fontFamily: fonts.body, color: colors.textSecondary,
        marginTop: spacing.sm, fontStyle: 'italic',
    },
});
