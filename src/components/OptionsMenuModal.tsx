import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../lib/theme';
import BaseModal from './BaseModal';

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
        <BaseModal
            visible={visible}
            onRequestClose={onClose}
            dismissOnBackdropPress
            overlayStyle={styles.overlay}
            cardStyle={styles.card}
        >
            <Text style={styles.title}>{title}</Text>
            {options.map((opt) => (
                <Pressable
                    key={opt.label}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    onPress={() => { onClose(); opt.onSelect(); }}
                >
                    <Text style={styles.optionText}>{opt.label}</Text>
                </Pressable>
            ))}
            <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}
                onPress={onClose}
            >
                <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
        </BaseModal>
    );
}

const styles = StyleSheet.create({
    // Darker backdrop than the form modals; the menu sits on a flat surface.
    overlay: { backgroundColor: 'rgba(0,0,0,0.55)', padding: 24 },
    card: {
        backgroundColor: colors.bgMain,
        borderRadius: 16,
        padding: 0,
        paddingVertical: 12,
        maxWidth: 360,
        shadowOpacity: 0,
        elevation: 0,
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
