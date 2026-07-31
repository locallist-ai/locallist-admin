import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PlaceData } from '../types/place';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { PRICE_RANGES, BEST_TIMES, BEST_FOR } from '../lib/constants';

/**
 * Shared, presentational place-form fields (Location + Curation + Photos).
 * Single source of truth for the parts of the form that the create and edit
 * screens render identically. Screen-specific extras (visit duration on edit,
 * initial status on create) are injected via `curationExtra`.
 */
type PlaceFormFieldsProps = {
    form: Partial<PlaceData>;
    updateField: <K extends keyof PlaceData>(key: K, value: PlaceData[K]) => void;
    toggleBestFor: (tag: string) => void;
    toggleBestTime: (time: string) => void;
    removeTag: (tag: string) => void;
    newPhotoUrl: string;
    setNewPhotoUrl: (value: string) => void;
    addPhoto: () => void;
    removePhoto: (url: string) => void;
    /** Optional placeholder for the neighborhood field (create screen only). */
    neighborhoodPlaceholder?: string;
    /** Extra field rendered inside the Curation section after price range. */
    curationExtra?: React.ReactNode;
};

export default function PlaceFormFields({
    form,
    updateField,
    toggleBestFor,
    toggleBestTime,
    removeTag,
    newPhotoUrl,
    setNewPhotoUrl,
    addPhoto,
    removePhoto,
    neighborhoodPlaceholder,
    curationExtra,
}: PlaceFormFieldsProps) {
    const { t } = useTranslation();

    return (
        <>
            {/* Section: Location */}
            <Text style={styles.sectionTitle}>{t('place.sectionLocation')}</Text>
            <View style={styles.section}>
                <FieldLabel label={t('place.neighborhood')} />
                <TextInput
                    style={styles.input}
                    value={form.neighborhood ?? ''}
                    onChangeText={(v) => updateField('neighborhood', v)}
                    placeholder={neighborhoodPlaceholder}
                    placeholderTextColor={colors.textSecondary}
                />

                <FieldLabel label={t('place.city')} />
                <TextInput
                    style={styles.input}
                    value={form.city ?? ''}
                    onChangeText={(v) => updateField('city', v)}
                    placeholderTextColor={colors.textSecondary}
                />

                <View style={styles.row}>
                    <View style={styles.halfField}>
                        <FieldLabel label={t('place.latitude')} />
                        <TextInput
                            style={styles.input}
                            value={form.latitude?.toString() ?? ''}
                            onChangeText={(v) => updateField('latitude', v ? parseFloat(v) : undefined)}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                    <View style={styles.halfField}>
                        <FieldLabel label={t('place.longitude')} />
                        <TextInput
                            style={styles.input}
                            value={form.longitude?.toString() ?? ''}
                            onChangeText={(v) => updateField('longitude', v ? parseFloat(v) : undefined)}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                </View>
            </View>

            {/* Section: Curation */}
            <Text style={styles.sectionTitle}>{t('place.sectionCuration')}</Text>
            <View style={styles.section}>
                <FieldLabel label={t('place.bestFor')} />
                <View style={styles.chipRow}>
                    {BEST_FOR.map((tag) => {
                        const isActive = (form.bestFor ?? []).includes(tag);
                        return (
                            <Pressable
                                key={tag}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => toggleBestFor(tag)}
                            >
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                    {tag}
                                </Text>
                            </Pressable>
                        );
                    })}
                    {/* Legacy free-form values not in BEST_FOR: removable so they are not lost. */}
                    {(form.bestFor ?? [])
                        .filter((tag) => !BEST_FOR.includes(tag as (typeof BEST_FOR)[number]))
                        .map((tag) => (
                            <Pressable key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                                <Text style={styles.tagChipText}>{tag} ×</Text>
                            </Pressable>
                        ))}
                </View>

                <FieldLabel label={t('place.bestTime')} />
                <View style={styles.chipRow}>
                    {BEST_TIMES.map((time) => {
                        const isActive = (form.bestTimes ?? []).includes(time);
                        return (
                            <Pressable
                                key={time}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => toggleBestTime(time)}
                            >
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                    {time}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <FieldLabel label={t('place.priceRange')} />
                <View style={styles.chipRow}>
                    {PRICE_RANGES.map((pr) => (
                        <Pressable
                            key={pr}
                            style={[
                                styles.chip,
                                form.priceRange === pr && (pr === 'FREE' ? styles.chipFree : styles.chipActive),
                            ]}
                            onPress={() => updateField('priceRange', pr)}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    form.priceRange === pr && (pr === 'FREE' ? styles.chipTextFree : styles.chipTextActive),
                                ]}
                            >
                                {pr}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {curationExtra}
            </View>

            {/* Section: Photos */}
            <Text style={styles.sectionTitle}>{t('place.sectionPhotos')}</Text>
            <View style={styles.section}>
                {(form.photos ?? []).map((url) => (
                    <View key={url} style={styles.photoRow}>
                        <Image source={{ uri: url }} style={styles.photoThumb} />
                        <Text style={styles.photoUrl} numberOfLines={1}>
                            {url}
                        </Text>
                        <Pressable onPress={() => removePhoto(url)} hitSlop={8}>
                            <Text style={styles.removeBtn}>×</Text>
                        </Pressable>
                    </View>
                ))}
                <View style={styles.addRow}>
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={newPhotoUrl}
                        onChangeText={setNewPhotoUrl}
                        placeholder={t('place.pastePhotoUrl')}
                        placeholderTextColor={colors.textSecondary}
                        onSubmitEditing={addPhoto}
                        returnKeyType="done"
                        autoCapitalize="none"
                    />
                    <Pressable style={styles.addBtn} onPress={addPhoto}>
                        <Text style={styles.addBtnText}>+</Text>
                    </Pressable>
                </View>
            </View>
        </>
    );
}

function FieldLabel({ label }: { label: string }) {
    return <Text style={styles.fieldLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 13,
        fontFamily: fonts.bodySemiBold,
        color: colors.electricBlue,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    section: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderColor,
    },
    fieldLabel: {
        fontSize: 13,
        fontFamily: fonts.bodySemiBold,
        color: colors.textSecondary,
        marginBottom: 6,
        marginTop: spacing.md,
    },
    input: {
        backgroundColor: colors.bgMain,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        color: colors.textMain,
        fontFamily: fonts.body,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.borderColor,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    halfField: {
        flex: 1,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.borderColor,
    },
    chipActive: {
        backgroundColor: colors.electricBlue,
        borderColor: colors.electricBlue,
    },
    chipFree: {
        backgroundColor: colors.successEmerald,
        borderColor: colors.successEmerald,
    },
    chipText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontFamily: fonts.bodySemiBold,
    },
    chipTextActive: {
        color: '#fff',
    },
    chipTextFree: {
        color: '#fff',
    },
    tagChip: {
        backgroundColor: colors.electricBlueLight,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
    },
    tagChipText: {
        fontSize: 13,
        color: colors.electricBlue,
        fontFamily: fonts.bodySemiBold,
    },
    addRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    addBtn: {
        backgroundColor: colors.electricBlue,
        width: 44,
        height: 44,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtnText: {
        color: '#fff',
        fontSize: 22,
        fontFamily: fonts.bodyBold,
    },
    photoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: spacing.sm,
        backgroundColor: colors.bgMain,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
    },
    photoThumb: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.borderColor,
    },
    photoUrl: {
        flex: 1,
        fontSize: 12,
        fontFamily: fonts.body,
        color: colors.textSecondary,
    },
    removeBtn: {
        fontSize: 22,
        color: colors.error,
        fontFamily: fonts.bodyBold,
        paddingHorizontal: spacing.sm,
    },
});
