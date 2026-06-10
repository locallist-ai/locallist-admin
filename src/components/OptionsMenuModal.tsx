import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export type MenuOption = {
    label: string;
    onSelect: () => void;
};

type Props = {
    visible: boolean;
    title: string;
    options: MenuOption[];
    onClose: () => void;
};

/**
 * Menú de opciones cross-platform. Sustituye a Alert.alert con varios botones
 * (no-op en react-native-web) y a ActionSheetIOS fuera de iOS.
 */
export default function OptionsMenuModal({ visible, title, options, onClose }: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.title}>{title}</Text>
                    {options.map((opt) => (
                        <Pressable
                            key={opt.label}
                            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                            onPress={() => { onClose(); opt.onSelect(); }}
                        >
                            <Text style={styles.optionText}>{opt.label}</Text>
                        </Pressable>
                    ))}
                    <Pressable
                        style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    card: {
        backgroundColor: colors.bgMain, borderRadius: 16, paddingVertical: 12,
        width: '100%', maxWidth: 360,
    },
    title: {
        color: colors.textSecondary, fontFamily: fonts.bodySemiBold, fontSize: 13,
        textAlign: 'center', paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.6,
    },
    option: {
        paddingVertical: 14, paddingHorizontal: 20,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderColor,
    },
    optionPressed: { backgroundColor: colors.borderColor },
    optionText: {
        color: colors.textMain, fontFamily: fonts.body, fontSize: 16, textAlign: 'center',
    },
    cancel: {
        paddingVertical: 14, paddingHorizontal: 20, marginTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderColor,
    },
    cancelText: {
        color: colors.textSecondary, fontFamily: fonts.bodySemiBold, fontSize: 16, textAlign: 'center',
    },
});
