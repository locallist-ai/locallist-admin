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
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { api } from '../../../src/lib/api';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportRow {
    input: string;
    placeId?: string;
    name?: string;
    status: string;
    error?: string;
}

interface ImportResponse {
    resolved: number;
    created: number;
    skipped: number;
    failed: number;
    rows: ImportRow[];
}

interface BatchProgress {
    total: number;
    processed: number;
    created: number;
    skipped: number;
    failed: number;
    rows: ImportRow[];
}

const CHUNK_SIZE = 50;
const STATUSES = ['in_review', 'published', 'draft'] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseUrlsFromText(text: string): string[] {
    return text
        .split(/\r?\n+/)
        .map(u => u.trim())
        .filter(u => u.length > 0);
}

async function parseUrlsFromCsv(fileUri: string): Promise<string[]> {
    const response = await fetch(fileUri);
    const text = await response.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return result.data
        .map(row => (row[0] ?? '').trim())
        .filter(u => u.length > 0);
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ImportBatchScreen() {
    const [mode, setMode] = useState<'text' | 'csv'>('text');
    const [urlText, setUrlText] = useState('');
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [csvUrls, setCsvUrls] = useState<string[]>([]);
    const [defaultCity, setDefaultCity] = useState('Miami');
    const [defaultStatus, setDefaultStatus] = useState<string>('in_review');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<BatchProgress | null>(null);

    const activeUrls = mode === 'text' ? parseUrlsFromText(urlText) : csvUrls;

    const handlePickCsv = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;

            const file = result.assets[0];
            const urls = await parseUrlsFromCsv(file.uri);
            setCsvUrls(urls);
            setCsvFileName(file.name);
        } catch {
            showAlert('Error', 'Could not read the CSV file.');
        }
    };

    const handleImport = async () => {
        const urls = activeUrls;
        if (urls.length === 0) {
            showAlert('No URLs', 'Add at least one URL before importing.');
            return;
        }
        if (urls.length > 500) {
            showAlert('Limit', 'Maximum 500 URLs per import.');
            return;
        }

        setLoading(true);
        const prog: BatchProgress = {
            total: urls.length,
            processed: 0,
            created: 0,
            skipped: 0,
            failed: 0,
            rows: [],
        };
        setProgress({ ...prog });

        const chunks: string[][] = [];
        for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
            chunks.push(urls.slice(i, i + CHUNK_SIZE));
        }

        for (const chunk of chunks) {
            const res = await api<ImportResponse>('/admin/places/import-from-urls', {
                method: 'POST',
                body: {
                    urls: chunk,
                    defaultCity: defaultCity.trim() || 'Miami',
                    defaultStatus,
                },
                timeoutMs: 120_000,
            });

            if (res.data) {
                prog.created += res.data.created;
                prog.skipped += res.data.skipped;
                prog.failed += res.data.failed;
                prog.rows.push(...res.data.rows);
            } else {
                // Whole chunk failed (network/server error)
                const failedRows: ImportRow[] = chunk.map(u => ({
                    input: u,
                    status: 'failed_resolve',
                    error: res.error ?? 'Request failed',
                }));
                prog.failed += chunk.length;
                prog.rows.push(...failedRows);
            }

            prog.processed += chunk.length;
            setProgress({ ...prog });
        }

        setLoading(false);
    };

    const handleReset = () => {
        setProgress(null);
        setUrlText('');
        setCsvUrls([]);
        setCsvFileName(null);
    };

    const errorRows = progress?.rows.filter(r => r.status.startsWith('failed')) ?? [];

    return (
        <>
            <Stack.Screen options={{ title: 'Batch Import' }} />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                {/* Mode tabs */}
                <View style={styles.tabs}>
                    <Pressable
                        style={[styles.tab, mode === 'text' && styles.tabActive]}
                        onPress={() => setMode('text')}
                    >
                        <Text style={[styles.tabText, mode === 'text' && styles.tabTextActive]}>
                            Paste links
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, mode === 'csv' && styles.tabActive]}
                        onPress={() => setMode('csv')}
                    >
                        <Text style={[styles.tabText, mode === 'csv' && styles.tabTextActive]}>
                            Upload CSV
                        </Text>
                    </Pressable>
                </View>

                {/* Input area */}
                {mode === 'text' ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>Google Maps links (one per line)</Text>
                        <TextInput
                            style={styles.textArea}
                            value={urlText}
                            onChangeText={setUrlText}
                            placeholder={
                                'https://www.google.com/maps/place/...\nChIJN1t_tDeuEmsRUsoyG83frY4'
                            }
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={8}
                            textAlignVertical="top"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Text style={styles.hint}>
                            {`One URL per line. Use canonical URLs (google.com/maps/place/...) or Place IDs (ChIJ...). Short links (maps.app.goo.gl) don't work. Open them in the browser first and copy the full URL.`}
                        </Text>
                        {activeUrls.length > 0 && (
                            <Text style={styles.hint}>{activeUrls.length} URLs detected</Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.label}>CSV file (first column = URL)</Text>
                        <Pressable style={styles.csvBtn} onPress={handlePickCsv}>
                            <Text style={styles.csvBtnText}>
                                {csvFileName ? `📄 ${csvFileName}` : '📂 Choose CSV file…'}
                            </Text>
                        </Pressable>
                        {csvUrls.length > 0 && (
                            <Text style={styles.hint}>{csvUrls.length} URLs found</Text>
                        )}
                        {csvUrls.slice(0, 3).map((url, i) => (
                            <Text key={i} style={styles.csvPreview} numberOfLines={1}>{url}</Text>
                        ))}
                        {csvUrls.length > 3 && (
                            <Text style={styles.hint}>…and {csvUrls.length - 3} more</Text>
                        )}
                    </View>
                )}

                {/* Config */}
                <View style={styles.section}>
                    <Text style={styles.label}>Default city</Text>
                    <TextInput
                        style={styles.input}
                        value={defaultCity}
                        onChangeText={setDefaultCity}
                        placeholder="Miami"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <Text style={[styles.label, { marginTop: spacing.md }]}>Initial status</Text>
                    <View style={styles.chipRow}>
                        {STATUSES.map(s => (
                            <Pressable
                                key={s}
                                style={[styles.chip, defaultStatus === s && styles.chipActive]}
                                onPress={() => setDefaultStatus(s)}
                            >
                                <Text style={[styles.chipText, defaultStatus === s && styles.chipTextActive]}>
                                    {s}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Progress */}
                {progress && (
                    <View style={styles.progressBox}>
                        <Text style={styles.progressTitle}>
                            {loading
                                ? `Importing ${progress.processed} / ${progress.total}…`
                                : `Done: ${progress.total} processed`}
                        </Text>
                        <View style={styles.statsRow}>
                            <Text style={[styles.stat, styles.statCreated]}>✓ {progress.created} created</Text>
                            <Text style={[styles.stat, styles.statSkipped]}>– {progress.skipped} duplicates</Text>
                            <Text style={[styles.stat, styles.statFailed]}>✗ {progress.failed} errors</Text>
                        </View>

                        {/* Progress bar */}
                        <View style={styles.bar}>
                            <View
                                style={[styles.barFill, {
                                    width: `${Math.round((progress.processed / progress.total) * 100)}%` as any,
                                }]}
                            />
                        </View>

                        {/* Error rows */}
                        {errorRows.length > 0 && (
                            <View style={styles.errorList}>
                                <Text style={styles.errorListTitle}>URLs with errors:</Text>
                                {errorRows.map((row, i) => (
                                    <View key={i} style={styles.errorRow}>
                                        <Text style={styles.errorUrl} numberOfLines={1}>{row.input}</Text>
                                        <Text style={styles.errorMsg}>{row.status}: {row.error}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Actions */}
                {!loading && progress === null && (
                    <Pressable
                        style={[styles.importBtn, activeUrls.length === 0 && styles.importBtnDisabled]}
                        onPress={handleImport}
                        disabled={activeUrls.length === 0}
                    >
                        <Text style={styles.importBtnText}>
                            Import {activeUrls.length > 0 ? `${activeUrls.length} places` : '…'}
                        </Text>
                    </Pressable>
                )}

                {loading && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator color={colors.electricBlue} />
                        <Text style={styles.loadingText}>Processing…</Text>
                    </View>
                )}

                {!loading && progress !== null && (
                    <Pressable style={styles.resetBtn} onPress={handleReset}>
                        <Text style={styles.resetBtnText}>New import</Text>
                    </Pressable>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgMain },
    content: { padding: 20, maxWidth: 680, alignSelf: 'center', width: '100%' },

    tabs: { flexDirection: 'row', borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.md },
    tab: {
        flex: 1, paddingVertical: 10, alignItems: 'center',
        backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderColor,
    },
    tabActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    tabText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
    tabTextActive: { color: '#fff' },

    section: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.borderColor,
        marginBottom: spacing.md,
    },
    label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textSecondary, marginBottom: 6 },
    input: {
        backgroundColor: colors.bgMain, borderRadius: borderRadius.sm, padding: spacing.md,
        color: colors.textMain, fontFamily: fonts.body, fontSize: 15,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    textArea: {
        backgroundColor: colors.bgMain, borderRadius: borderRadius.sm, padding: spacing.md,
        color: colors.textMain, fontFamily: fonts.body, fontSize: 13, minHeight: 160,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    hint: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.body, marginTop: 6 },
    csvBtn: {
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.electricBlue,
        padding: spacing.md, alignItems: 'center',
    },
    csvBtnText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.electricBlue },
    csvPreview: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body, marginTop: 4 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    chipActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    chipText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bodySemiBold },
    chipTextActive: { color: '#fff' },

    progressBox: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.borderColor,
        marginBottom: spacing.md,
    },
    progressTitle: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain, marginBottom: 8 },
    statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: 10, flexWrap: 'wrap' },
    stat: { fontSize: 13, fontFamily: fonts.bodySemiBold },
    statCreated: { color: colors.successEmerald },
    statSkipped: { color: colors.textSecondary },
    statFailed: { color: colors.error },

    bar: { height: 6, backgroundColor: colors.borderColor, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    barFill: { height: 6, backgroundColor: colors.successEmerald },

    errorList: { marginTop: spacing.sm },
    errorListTitle: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.error, marginBottom: 6 },
    errorRow: { marginBottom: 8, borderLeftWidth: 2, borderLeftColor: colors.error, paddingLeft: 8 },
    errorUrl: { fontSize: 12, fontFamily: fonts.body, color: colors.textMain },
    errorMsg: { fontSize: 11, fontFamily: fonts.body, color: colors.textSecondary },

    importBtn: {
        backgroundColor: colors.successEmerald, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md,
    },
    importBtnDisabled: { backgroundColor: colors.textSecondary, opacity: 0.5 },
    importBtnText: { fontSize: 16, fontFamily: fonts.bodyBold, color: '#fff' },

    loadingRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
    loadingText: { fontSize: 14, fontFamily: fonts.body, color: colors.textSecondary },

    resetBtn: {
        borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.electricBlue,
        paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md,
    },
    resetBtnText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.electricBlue },
});
