import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

interface AddSubcategoryModalProps {
    visible: boolean;
    categoryKey: string;
    onConfirm: (payload: { key: string; labelEn: string; labelEs: string }) => Promise<void>;
    onCancel: () => void;
}

const SLUG_RE = /^[a-z0-9-]+$/;

export default function AddSubcategoryModal({
    visible,
    categoryKey,
    onConfirm,
    onCancel,
}: AddSubcategoryModalProps) {
    const [key, setKey] = useState('');
    const [labelEn, setLabelEn] = useState('');
    const [labelEs, setLabelEs] = useState('');
    const [saving, setSaving] = useState(false);
    const [keyError, setKeyError] = useState('');

    const reset = () => {
        setKey('');
        setLabelEn('');
        setLabelEs('');
        setKeyError('');
        setSaving(false);
    };

    const handleCancel = () => {
        reset();
        onCancel();
    };

    const handleKeyChange = (v: string) => {
        const lower = v.toLowerCase().replace(/\s+/g, '-');
        setKey(lower);
        setKeyError(lower && !SLUG_RE.test(lower) ? 'Only lowercase letters, digits, hyphens.' : '');
    };

    const isValid = key.trim() && labelEn.trim() && labelEs.trim() && SLUG_RE.test(key);

    const handleConfirm = async () => {
        if (!isValid || saving) return;
        setSaving(true);
        try {
            await onConfirm({ key: key.trim(), labelEn: labelEn.trim(), labelEs: labelEs.trim() });
            reset();
        } catch {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>New Subcategory</Text>
                    <Text style={styles.subtitle}>Category: {categoryKey}</Text>

                    <Text style={styles.fieldLabel}>Slug (key)</Text>
                    <TextInput
                        style={[styles.input, keyError ? styles.inputError : undefined]}
                        placeholder="e.g. rooftop-bar"
                        placeholderTextColor={colors.textSecondary}
                        value={key}
                        onChangeText={handleKeyChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {!!keyError && <Text style={styles.errorText}>{keyError}</Text>}

                    <Text style={styles.fieldLabel}>Label EN</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Rooftop Bar"
                        placeholderTextColor={colors.textSecondary}
                        value={labelEn}
                        onChangeText={setLabelEn}
                    />

                    <Text style={styles.fieldLabel}>Label ES</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Bar en Azotea"
                        placeholderTextColor={colors.textSecondary}
                        value={labelEs}
                        onChangeText={setLabelEs}
                    />

                    <View style={styles.actions}>
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
                                : <Text style={styles.createText}>Create</Text>
                            }
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
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
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.md,
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
