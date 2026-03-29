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
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

interface RejectionModalProps {
    visible: boolean;
    placeName: string;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
}

export default function RejectionModal({ visible, placeName, onConfirm, onCancel }: RejectionModalProps) {
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        const trimmed = reason.trim();
        if (!trimmed) return;
        onConfirm(trimmed);
        setReason('');
    };

    const handleCancel = () => {
        setReason('');
        onCancel();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>Reject Place</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {placeName}
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Reason for rejection..."
                        placeholderTextColor={colors.textSecondary}
                        value={reason}
                        onChangeText={setReason}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        autoFocus
                    />

                    <View style={styles.actions}>
                        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.rejectBtn, !reason.trim() && styles.disabledBtn]}
                            onPress={handleConfirm}
                            disabled={!reason.trim()}
                        >
                            <Text style={styles.rejectText}>Reject</Text>
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
    input: {
        backgroundColor: colors.bgMain,
        borderRadius: 10,
        padding: 14,
        color: colors.textMain,
        fontFamily: fonts.body,
        fontSize: 15,
        minHeight: 80,
        borderWidth: 1,
        borderColor: colors.borderColor,
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
    rejectBtn: {
        backgroundColor: colors.error,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
    },
    disabledBtn: {
        opacity: 0.4,
    },
    rejectText: {
        color: '#fff',
        fontFamily: fonts.bodyBold,
        fontSize: 15,
    },
});
