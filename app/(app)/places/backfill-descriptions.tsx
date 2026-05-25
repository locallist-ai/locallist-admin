import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Stack } from 'expo-router';
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
            Alert.alert('Error', res.error ?? 'Request failed.');
        }
    };

    const handleRun = () => {
        Alert.alert(
            'Run backfill',
            `This will fetch descriptions for up to ${parsedLimit} places and write to the database. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Run', style: 'destructive', onPress: runBackfill },
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
            Alert.alert('Error', res.error ?? 'Request failed.');
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Backfill descriptions',
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                <Text style={styles.sectionTitle}>How it works</Text>
                <View style={styles.section}>
                    <Text style={styles.bodyText}>
                        For every place whose description is still the Google import placeholder, this tool fetches the editorial text from Google Places. If Google has no editorial, it falls back to Gemini.
                    </Text>
                    <Text style={[styles.bodyText, styles.bodyTextMuted]}>
                        Rejected places are skipped. Run dry first to see the count before writing.
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>Options</Text>
                <View style={styles.section}>
                    <Text style={styles.fieldLabel}>Limit (1–200)</Text>
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
                            : <Text style={styles.dryRunBtnText}>Dry run</Text>
                        }
                    </Pressable>
                    <Pressable
                        style={[styles.runBtn, loading && styles.btnDisabled]}
                        onPress={handleRun}
                        disabled={loading}
                    >
                        <Text style={styles.runBtnText}>Run backfill</Text>
                    </Pressable>
                </View>

                {result && (
                    <>
                        <Text style={styles.sectionTitle}>Result</Text>
                        <View style={styles.resultBox}>
                            <ResultRow label="Candidates" value={result.candidates} />
                            {result.dryRun ? (
                                <>
                                    <ResultRow label="Would fetch from Google" value={(result as DryRunResult).wouldFetchGoogle} color={colors.successEmerald} />
                                    <ResultRow label="Would fallback to Gemini" value={(result as DryRunResult).wouldFallbackGemini} color={colors.electricBlue} />
                                    <Text style={styles.dryRunNote}>Dry run — no changes written.</Text>
                                </>
                            ) : (
                                <>
                                    <ResultRow label="Filled from Google" value={(result as RunResult).googleFilled} color={colors.successEmerald} />
                                    <ResultRow label="Filled from Gemini" value={(result as RunResult).geminiFilled} color={colors.electricBlue} />
                                    <ResultRow label="Failed (no source)" value={(result as RunResult).failed} color={colors.error} />
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
