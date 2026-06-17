import React from 'react';
import {
    Modal,
    View,
    Pressable,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius } from '../lib/theme';

interface BaseModalProps {
    visible: boolean;
    /** Fired by the hardware back button and, when enabled, a backdrop tap. */
    onRequestClose: () => void;
    children: React.ReactNode;
    /** Tap on the backdrop dismisses the modal (menu/sheet style). */
    dismissOnBackdropPress?: boolean;
    /** Wrap the card in a KeyboardAvoidingView (forms with inputs). */
    avoidKeyboard?: boolean;
    /** Extend/override the backdrop (e.g. a darker tint). */
    overlayStyle?: StyleProp<ViewStyle>;
    /** Extend/override the card container (e.g. a different surface or maxHeight). */
    cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Shared chrome for the app's centered modals: a translucent backdrop and a
 * rounded card. `avoidKeyboard` lifts the card above the keyboard for forms;
 * `dismissOnBackdropPress` turns the backdrop into a tap-to-close target for
 * menus (the card stops propagation so taps inside don't dismiss).
 */
export default function BaseModal({
    visible,
    onRequestClose,
    children,
    dismissOnBackdropPress = false,
    avoidKeyboard = false,
    overlayStyle,
    cardStyle,
}: BaseModalProps) {
    const card = <View style={[styles.card, cardStyle]}>{children}</View>;

    let body: React.ReactNode;
    if (dismissOnBackdropPress) {
        body = (
            <Pressable style={[styles.overlay, overlayStyle]} onPress={onRequestClose}>
                <Pressable style={[styles.card, cardStyle]} onPress={(e) => e.stopPropagation()}>
                    {children}
                </Pressable>
            </Pressable>
        );
    } else if (avoidKeyboard) {
        body = (
            <KeyboardAvoidingView
                style={[styles.overlay, overlayStyle]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {card}
            </KeyboardAvoidingView>
        );
    } else {
        body = <View style={[styles.overlay, overlayStyle]}>{card}</View>;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onRequestClose}
            accessibilityViewIsModal
        >
            {body}
        </Modal>
    );
}

/** Shared modal styles. `actions` is the flex-end button row used by form modals. */
export const baseModalStyles = StyleSheet.create({
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
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.md,
    },
});

const styles = baseModalStyles;
