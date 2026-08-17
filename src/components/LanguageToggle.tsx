import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, colors, fonts, spacing } from '../lib/theme';
import { targetLabel, targetLanguage } from '../lib/languageToggle';

/**
 * Compact EN/ES language switch for the admin header. Two languages, so a
 * single toggle (rather than a picker) is the simplest accessible control:
 * it shows the TARGET language code (the one you switch TO) and flips to it on
 * press. Reverts the old "admin is English-only" convention.
 */
export default function LanguageToggle() {
    const { t, i18n } = useTranslation();
    const current = i18n.language.startsWith('es') ? 'es' : 'en';
    const target = targetLanguage(current);

    const toggle = () => {
        i18n.changeLanguage(target);
    };

    return (
        <Pressable
            onPress={toggle}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel={t('language.a11y', {
                language: t(target === 'es' ? 'language.spanish' : 'language.english'),
            })}
        >
            <Text style={styles.text}>{targetLabel(current)}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    btn: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.electricBlue,
        alignItems: 'center', justifyContent: 'center',
    },
    text: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 14 },
});
