import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { showAlert } from '../lib/dialogs';
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
    const { t } = useTranslation();
    const [reindexing, setReindexing] = useState(false);
    const [backfillingHours, setBackfillingHours] = useState(false);

    const handleReindex = () => {
        showAlert(
            t('placesList.reindexTitle'),
            t('placesList.reindexMsg'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('placesList.reindex'),
                    onPress: async () => {
                        setReindexing(true);
                        const res = await api<{ reindexed: number; failed: number; total: number }>(
                            '/admin/places/reindex-embeddings',
                            { method: 'POST' }
                        );
                        setReindexing(false);
                        if (res.data) {
                            showAlert(t('common.done'), t('placesList.reindexDone', { done: String(res.data.reindexed), total: String(res.data.total) }));
                        } else {
                            showAlert(t('common.error'), t('placesList.reindexFailed', { error: res.error ?? '' }));
                        }
                    },
                },
            ]
        );
    };

    const handleBackfillHours = () => {
        showAlert(
            t('placesList.backfillHoursTitle'),
            t('placesList.backfillHoursMsg'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('placesList.backfillHoursConfirm'),
                    onPress: async () => {
                        setBackfillingHours(true);
                        const res = await api<{ backfilled: number; failed: number; total: number }>(
                            '/admin/places/backfill-opening-hours?onlyMissing=true&limit=200',
                            { method: 'POST' }
                        );
                        setBackfillingHours(false);
                        if (res.data) {
                            showAlert(t('common.done'), t('placesList.backfillHoursDone', { done: String(res.data.backfilled), total: String(res.data.total), failed: String(res.data.failed) }));
                        } else {
                            showAlert(t('common.error'), t('placesList.backfillHoursFailed', { error: res.error ?? '' }));
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
                <Text style={batchBtnStyles.batchTranslateBtnText}>{t('placesList.translateEs')}</Text>
            </Pressable>
            <Pressable
                style={[styles.reindexBtn, reindexing && { opacity: 0.5 }]}
                onPress={handleReindex}
                disabled={reindexing}
            >
                {reindexing
                    ? <ActivityIndicator color={colors.sunsetOrange} size="small" />
                    : <Text style={[batchBtnStyles.batchTranslateBtnText, { color: colors.sunsetOrange }]}>{t('placesList.reindex')}</Text>
                }
            </Pressable>
            <Pressable
                style={[styles.reindexBtn, backfillingHours && { opacity: 0.5 }]}
                onPress={handleBackfillHours}
                disabled={backfillingHours}
            >
                {backfillingHours
                    ? <ActivityIndicator color={colors.electricBlue} size="small" />
                    : <Text style={[batchBtnStyles.batchTranslateBtnText, { color: colors.electricBlue }]}>{t('placesList.hours')}</Text>
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
