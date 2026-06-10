import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { api } from '../lib/api';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

interface BatchActionsRowProps {
    /** True while a batch translate is running (shared with the plans button). */
    translateDisabled: boolean;
    onTranslate: () => void;
}

/**
 * Admin batch actions for published places: batch translate (delegated to
 * the parent, which owns the progress overlay), plus reindex embeddings
 * and opening-hours backfill, which are self-contained fire-and-report ops.
 */
export default function BatchActionsRow({ translateDisabled, onTranslate }: BatchActionsRowProps) {
    const [reindexing, setReindexing] = useState(false);
    const [backfillingHours, setBackfillingHours] = useState(false);

    const handleReindex = () => {
        Alert.alert(
            'Reindex Embeddings',
            'This regenerates vector embeddings for all published places. Takes ~30s. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reindex',
                    onPress: async () => {
                        setReindexing(true);
                        const res = await api<{ reindexed: number; failed: number; total: number }>(
                            '/admin/places/reindex-embeddings',
                            { method: 'POST' }
                        );
                        setReindexing(false);
                        if (res.data) {
                            Alert.alert('Done', `Reindexed: ${res.data.reindexed}/${res.data.total}`);
                        } else {
                            Alert.alert('Error', `Reindex failed: ${res.error}`);
                        }
                    },
                },
            ]
        );
    };

    const handleBackfillHours = () => {
        Alert.alert(
            'Backfill Opening Hours',
            'Fetches opening hours from Google for all places missing them. May take a while. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Backfill',
                    onPress: async () => {
                        setBackfillingHours(true);
                        const res = await api<{ backfilled: number; failed: number; total: number }>(
                            '/admin/places/backfill-opening-hours?onlyMissing=true&limit=200',
                            { method: 'POST' }
                        );
                        setBackfillingHours(false);
                        if (res.data) {
                            Alert.alert('Done', `Backfilled: ${res.data.backfilled}/${res.data.total} (${res.data.failed} failed)`);
                        } else {
                            Alert.alert('Error', `Backfill failed: ${res.error}`);
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.batchActionsRow}>
            <Pressable
                style={[batchBtnStyles.batchTranslateBtn, { flex: 1 }, translateDisabled && { opacity: 0.5 }]}
                onPress={onTranslate}
                disabled={translateDisabled}
            >
                <Text style={batchBtnStyles.batchTranslateBtnText}>Translate → ES</Text>
            </Pressable>
            <Pressable
                style={[styles.reindexBtn, reindexing && { opacity: 0.5 }]}
                onPress={handleReindex}
                disabled={reindexing}
            >
                {reindexing
                    ? <ActivityIndicator color={colors.sunsetOrange} size="small" />
                    : <Text style={[batchBtnStyles.batchTranslateBtnText, { color: colors.sunsetOrange }]}>Reindex</Text>
                }
            </Pressable>
            <Pressable
                style={[styles.reindexBtn, backfillingHours && { opacity: 0.5 }]}
                onPress={handleBackfillHours}
                disabled={backfillingHours}
            >
                {backfillingHours
                    ? <ActivityIndicator color={colors.electricBlue} size="small" />
                    : <Text style={[batchBtnStyles.batchTranslateBtnText, { color: colors.electricBlue }]}>Hours</Text>
                }
            </Pressable>
        </View>
    );
}

/** Shared with the plans-mode translate button in the dashboard. */
export const batchBtnStyles = StyleSheet.create({
    batchTranslateBtn: {
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.electricBlue,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    },
    batchTranslateBtnText: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});

const styles = StyleSheet.create({
    batchActionsRow: {
        flexDirection: 'row', marginHorizontal: 20, marginBottom: spacing.sm, gap: spacing.sm,
    },
    reindexBtn: {
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.sunsetOrange,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    },
});
