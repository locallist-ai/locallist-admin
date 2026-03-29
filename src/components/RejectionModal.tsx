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
                        placeholderTextColor="#64748b"
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 16,
    },
    input: {
        backgroundColor: '#0f172a',
        borderRadius: 10,
        padding: 14,
        color: '#f8fafc',
        fontSize: 15,
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#334155',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 16,
    },
    cancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    cancelText: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 15,
    },
    rejectBtn: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    disabledBtn: {
        opacity: 0.4,
    },
    rejectText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
