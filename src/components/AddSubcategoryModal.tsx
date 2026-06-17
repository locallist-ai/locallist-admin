import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import BaseModal, { baseModalStyles } from './BaseModal';
import {
    isDraftComplete,
    validateDraft,
    type BatchCreateResult,
    type SubcategoryDraft,
} from '../lib/subcategories';

export type { SubcategoryDraft } from '../lib/subcategories';

interface DraftRow extends SubcategoryDraft {
    /** Stable identity for React keys: rows are removable, so index keys
     *  would re-associate input state with the wrong row after a removal. */
    id: number;
    error: string;
}

interface AddSubcategoryModalProps {
    visible: boolean;
    categoryKey: string;
    /** Creates the drafts; partial failures come back in the result, not as a throw. */
    onCreate: (drafts: SubcategoryDraft[]) => Promise<BatchCreateResult>;
    /** Called with the keys that DID get created (possibly a partial batch). */
    onCreated: (keys: string[]) => void;
    onClose: () => void;
}

let rowSeq = 0;
const emptyRow = (): DraftRow => ({ id: ++rowSeq, key: '', labelEn: '', labelEs: '', error: '' });

export default function AddSubcategoryModal({
    visible,
    categoryKey,
    onCreate,
    onCreated,
    onClose,
}: AddSubcategoryModalProps) {
    const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const reset = () => {
        setRows([emptyRow()]);
        setSubmitError('');
        setSaving(false);
    };

    const handleCancel = () => {
        // Android back (onRequestClose) can fire mid-batch; resetting then
        // would corrupt the in-flight state and lose the user's rows.
        if (saving) return;
        reset();
        onClose();
    };

    const updateRow = (index: number, patch: Partial<SubcategoryDraft>) => {
        setRows((prev) => {
            const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r));
            return next.map((r, i) => ({ ...r, error: validateDraft(r, i, next) }));
        });
        setSubmitError('');
    };

    const handleKeyChange = (index: number, v: string) => {
        updateRow(index, { key: v.toLowerCase().replace(/\s+/g, '-') });
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);

    const removeRow = (index: number) => {
        setRows((prev) => {
            const next = prev.filter((_, i) => i !== index);
            return next.map((r, i) => ({ ...r, error: validateDraft(r, i, next) }));
        });
    };

    // Validity is recomputed from the drafts alone: a stored server error
    // (e.g. a transient network failure) must not lock the Create button
    // behind an artificial "edit something first".
    const isValid = rows.length > 0
        && rows.every((r, i) => isDraftComplete(r) && !validateDraft(r, i, rows));

    const handleConfirm = async () => {
        if (!isValid || saving) return;
        setSaving(true);
        setSubmitError('');

        const drafts = rows.map((r) => ({
            key: r.key.trim(),
            labelEn: r.labelEn.trim(),
            labelEs: r.labelEs.trim(),
        }));

        let result: BatchCreateResult;
        try {
            result = await onCreate(drafts);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to create subcategories.');
            setSaving(false);
            return;
        }

        // Report partial successes immediately so they are never lost,
        // even when some rows below failed.
        if (result.created.length > 0) {
            onCreated(result.created.map((c) => c.key));
        }

        if (result.failures.length === 0) {
            reset();
            onClose();
            return;
        }

        // Keep only the failed rows, each with its own error, so the user
        // can fix and retry without retyping.
        setRows(result.failures.map((f) => ({
            id: ++rowSeq,
            key: f.payload.key,
            labelEn: f.payload.labelEn,
            labelEs: f.payload.labelEs,
            error: f.message,
        })));
        if (result.created.length > 0) {
            setSubmitError(`${result.created.length} created. The rows below failed. Fix and retry.`);
        }
        setSaving(false);
    };

    const createLabel = rows.length > 1 ? `Create ${rows.length}` : 'Create';

    return (
        <BaseModal
            visible={visible}
            onRequestClose={handleCancel}
            avoidKeyboard
            cardStyle={styles.card}
        >
            <Text style={styles.title}>New Subcategories</Text>
            <Text style={styles.subtitle}>Category: {categoryKey}</Text>

            <ScrollView style={styles.rowList} keyboardShouldPersistTaps="handled">
                        {rows.map((row, index) => (
                            <View key={row.id} style={styles.rowCard}>
                                {rows.length > 1 && (
                                    <Pressable
                                        style={styles.removeBtn}
                                        onPress={() => removeRow(index)}
                                        disabled={saving}
                                        hitSlop={8}
                                    >
                                        <Text style={styles.removeBtnText}>✕</Text>
                                    </Pressable>
                                )}

                                <Text style={styles.fieldLabel}>Slug (key)</Text>
                                <TextInput
                                    style={[styles.input, row.error ? styles.inputError : undefined]}
                                    placeholder="e.g. rooftop-bar"
                                    placeholderTextColor={colors.textSecondary}
                                    value={row.key}
                                    onChangeText={(v) => handleKeyChange(index, v)}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {!!row.error && <Text style={styles.errorText}>{row.error}</Text>}

                                <Text style={styles.fieldLabel}>Label EN</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Rooftop Bar"
                                    placeholderTextColor={colors.textSecondary}
                                    value={row.labelEn}
                                    onChangeText={(v) => updateRow(index, { labelEn: v })}
                                />

                                <Text style={styles.fieldLabel}>Label ES</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Bar en Azotea"
                                    placeholderTextColor={colors.textSecondary}
                                    value={row.labelEs}
                                    onChangeText={(v) => updateRow(index, { labelEs: v })}
                                />
                            </View>
                        ))}
                    </ScrollView>

                    <Pressable style={styles.addRowBtn} onPress={addRow} disabled={saving}>
                        <Text style={styles.addRowText}>+ Add another</Text>
                    </Pressable>

                    {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}

            <View style={baseModalStyles.actions}>
                <Pressable style={styles.cancelBtn} onPress={handleCancel} disabled={saving}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.createBtn, (!isValid || saving) && styles.disabledBtn]}
                    onPress={handleConfirm}
                    disabled={!isValid || saving}
                >
                    {saving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.createText}>{createLabel}</Text>
                    }
                </Pressable>
            </View>
        </BaseModal>
    );
}

const styles = StyleSheet.create({
    // Extends BaseModal's card: the row list can grow, so cap the height.
    card: {
        maxHeight: '85%',
    },
    title: {
        fontSize: 20,
        fontFamily: fonts.bodySemiBold,
        color: colors.textMain,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: fonts.body,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    // Numeric maxHeight + flexGrow: 0 so the list scrolls reliably on every
    // platform instead of depending on percentage clamps resolving.
    rowList: {
        flexGrow: 0,
        maxHeight: 380,
    },
    rowCard: {
        borderWidth: 1,
        borderColor: colors.borderColor,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    removeBtn: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        zIndex: 1,
    },
    removeBtnText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.bodySemiBold,
    },
    fieldLabel: {
        fontSize: 12,
        fontFamily: fonts.bodySemiBold,
        color: colors.textSecondary,
        marginBottom: 4,
        marginTop: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: colors.bgMain,
        borderRadius: 10,
        padding: 12,
        color: colors.textMain,
        fontFamily: fonts.body,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.borderColor,
    },
    inputError: {
        borderColor: colors.error,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        fontFamily: fonts.body,
        marginTop: 4,
    },
    addRowBtn: {
        paddingVertical: spacing.xs,
        marginTop: 2,
    },
    addRowText: {
        color: colors.electricBlue,
        fontFamily: fonts.bodySemiBold,
        fontSize: 14,
    },
    cancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
    },
    cancelText: {
        color: colors.textSecondary,
        fontFamily: fonts.bodySemiBold,
        fontSize: 15,
    },
    createBtn: {
        backgroundColor: colors.electricBlue,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
        minWidth: 80,
        alignItems: 'center',
    },
    disabledBtn: {
        opacity: 0.4,
    },
    createText: {
        color: '#fff',
        fontFamily: fonts.bodyBold,
        fontSize: 15,
    },
});
