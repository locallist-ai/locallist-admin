import React from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Image,
    Switch,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';
import { CATEGORIES } from '../../../src/lib/constants';
import AddSubcategoryModal from '../../../src/components/AddSubcategoryModal';
import PlaceFormFields from '../../../src/components/PlaceFormFields';
import { usePlaceForm } from '../../../src/hooks/usePlaceForm';

export default function PlaceEditScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams<{ id: string }>();
    const {
        place,
        loading,
        saving,
        form,
        updateField,
        hasDirty,
        handleSave,
        translating,
        suggesting,
        newPhotoUrl,
        setNewPhotoUrl,
        toggleBestFor,
        toggleBestTime,
        removeTag,
        addPhoto,
        removePhoto,
        handleSuggestTranslation,
        handleSuggestDescription,
        byCategory,
        addSubVisible,
        setAddSubVisible,
        createSubcategoriesForCurrentCategory,
        appendSubcategories,
    } = usePlaceForm(id);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.electricBlue} size="large" />
            </View>
        );
    }

    if (!place) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: colors.error, fontFamily: fonts.body }}>{t('placeEdit.notFound')}</Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: form.name || t('nav.editPlace'),
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Hero image */}
                {form.photos?.[0] ? (
                    <Image source={{ uri: form.photos[0] }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.heroImage, { backgroundColor: colors.borderColor, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: colors.textSecondary, fontFamily: fonts.body }}>{t('placeEdit.noPhoto')}</Text>
                    </View>
                )}

                {/* Section: Identity */}
                <Text style={styles.sectionTitle}>{t('place.sectionIdentity')}</Text>
                <View style={styles.section}>
                    <FieldLabel label={t('placeEdit.name')} />
                    <TextInput
                        style={styles.input}
                        value={form.name ?? ''}
                        onChangeText={(v) => updateField('name', v)}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('placeEdit.category')} />
                    <View style={styles.chipRow}>
                        {CATEGORIES.map((cat) => (
                            <Pressable
                                key={cat}
                                style={[styles.chip, form.category === cat && styles.chipActive]}
                                onPress={() => updateField('category', cat)}
                            >
                                <Text
                                    style={[styles.chipText, form.category === cat && styles.chipTextActive]}
                                >
                                    {cat}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label={t('place.subcategories')} />
                    {form.category ? (
                        <>
                            {(() => {
                                const dynamicSubs = byCategory[form.category] ?? [];
                                const selected = form.subcategories ?? [];
                                const legacyItems = selected.filter(
                                    (s) => !dynamicSubs.some((d) => d.key.toLowerCase() === s.toLowerCase())
                                );
                                return (
                                    <>
                                        {legacyItems.length > 0 && (
                                            <Text style={styles.legacySubcategoryWarning}>
                                                {t('placeEdit.legacyWarning', { items: legacyItems.join(', ') })}
                                            </Text>
                                        )}
                                        {dynamicSubs.length === 0 && legacyItems.length === 0 && (
                                            <Text style={styles.subcategoryHint}>
                                                {t('placeEdit.noSubcategories', { category: form.category })}
                                            </Text>
                                        )}
                                        <View style={styles.chipRow}>
                                            {dynamicSubs.map((sub) => {
                                                const isActive = selected.some((s) => s.toLowerCase() === sub.key.toLowerCase());
                                                return (
                                                    <Pressable
                                                        key={sub.key}
                                                        style={[styles.chip, isActive && styles.chipActive]}
                                                        onPress={() => {
                                                            const next = isActive
                                                                ? selected.filter((s) => s.toLowerCase() !== sub.key.toLowerCase())
                                                                : [...selected, sub.key];
                                                            updateField('subcategories', next);
                                                        }}
                                                    >
                                                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                                            {sub.labelEn}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                            <Pressable
                                                style={[styles.chip, styles.chipAdd]}
                                                onPress={() => setAddSubVisible(true)}
                                            >
                                                <Text style={styles.chipAddText}>{t('placeEdit.add')}</Text>
                                            </Pressable>
                                        </View>
                                        <AddSubcategoryModal
                                            visible={addSubVisible}
                                            categoryKey={form.category!}
                                            onCreate={createSubcategoriesForCurrentCategory}
                                            onCreated={appendSubcategories}
                                            onClose={() => setAddSubVisible(false)}
                                        />
                                    </>
                                );
                            })()}
                        </>
                    ) : (
                        <Text style={styles.subcategoryHint}>{t('place.selectCategoryFirst')}</Text>
                    )}

                    <FieldLabel label={t('placeEdit.whyThisPlace')} />
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={form.whyThisPlace ?? ''}
                        onChangeText={(v) => updateField('whyThisPlace', v)}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        placeholderTextColor={colors.textSecondary}
                    />
                    <Pressable
                        style={[styles.suggestBtn, suggesting && styles.suggestBtnDisabled]}
                        disabled={suggesting}
                        onPress={handleSuggestDescription}
                    >
                        {suggesting
                            ? <ActivityIndicator size="small" color={colors.textSecondary} />
                            : <Text style={styles.suggestBtnText}>{t('placeEdit.suggestAi')}</Text>
                        }
                    </Pressable>
                </View>

                <PlaceFormFields
                    form={form}
                    updateField={updateField}
                    toggleBestFor={toggleBestFor}
                    toggleBestTime={toggleBestTime}
                    removeTag={removeTag}
                    newPhotoUrl={newPhotoUrl}
                    setNewPhotoUrl={setNewPhotoUrl}
                    addPhoto={addPhoto}
                    removePhoto={removePhoto}
                    curationExtra={
                        <>
                            <FieldLabel label={t('placeEdit.visitDuration')} />
                            <TextInput
                                style={styles.input}
                                value={form.visitDurationMin != null ? form.visitDurationMin.toString() : ''}
                                onChangeText={(v) => updateField('visitDurationMin', v ? parseInt(v, 10) || null : null)}
                                keyboardType="number-pad"
                                placeholder={t('placeEdit.visitDurationPlaceholder')}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </>
                    }
                />

                {/* Section: Translations (ES) — any published place (curated or google-imported) */}
                {place?.status === 'published' && (
                    <>
                        <Text style={styles.sectionTitle}>{t('placeEdit.sectionTranslation')}</Text>
                        <View style={styles.section}>
                            <Pressable
                                style={[styles.translateBtn, translating && styles.saveBtnDisabled]}
                                onPress={handleSuggestTranslation}
                                disabled={translating}
                            >
                                {translating
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.translateBtnText}>{t('placeEdit.suggestEsTranslation')}</Text>
                                }
                            </Pressable>

                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>{t('placeEdit.approvedEs')}</Text>
                                <Switch
                                    value={form.translationStatusEs === 'approved'}
                                    onValueChange={(v) => updateField('translationStatusEs', v ? 'approved' : 'draft')}
                                    trackColor={{ false: colors.borderColor, true: colors.successEmerald }}
                                />
                            </View>

                            <FieldLabel label={t('placeEdit.nameEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.nameEs ?? ''}
                                onChangeText={(v) => updateField('nameEs', v || null)}
                                placeholder={form.name}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label={t('placeEdit.whyThisPlaceEs')} />
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                value={form.whyThisPlaceEs ?? ''}
                                onChangeText={(v) => updateField('whyThisPlaceEs', v || null)}
                                placeholder={form.whyThisPlace ?? ''}
                                placeholderTextColor={colors.textSecondary}
                                multiline numberOfLines={3} textAlignVertical="top"
                            />

                            <FieldLabel label={t('placeEdit.bestTimeEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.bestTimesEs?.join(', ') ?? ''}
                                onChangeText={(v) => updateField('bestTimesEs', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)}
                                placeholder={(form.bestTimes ?? []).join(', ')}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label={t('placeEdit.neighborhoodEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.neighborhoodEs ?? ''}
                                onChangeText={(v) => updateField('neighborhoodEs', v || null)}
                                placeholder={form.neighborhood ?? ''}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label={t('placeEdit.subcategoriesEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.subcategoriesEs?.join(', ') ?? ''}
                                onChangeText={(v) => updateField('subcategoriesEs', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)}
                                placeholder={(form.subcategories ?? []).join(', ')}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label={t('placeEdit.bestForEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.bestForEs?.join(', ') ?? ''}
                                onChangeText={(v) => updateField('bestForEs', v ? v.split(',').map(s => s.trim()).filter(Boolean) : null)}
                                placeholder={(form.bestFor ?? []).join(', ')}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label={t('placeEdit.suitableForEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.suitableForEs?.join(', ') ?? ''}
                                onChangeText={(v) => updateField('suitableForEs', v ? v.split(',').map(s => s.trim()).filter(Boolean) : null)}
                                placeholder={(form.suitableFor ?? []).join(', ')}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>
                    </>
                )}

                {/* Section: Metadata (read-only) */}
                <Text style={styles.sectionTitle}>{t('placeEdit.sectionMetadata')}</Text>
                <View style={styles.section}>
                    <MetadataRow label={t('placeEdit.metaStatus')} value={place.status} />
                    <MetadataRow label={t('placeEdit.metaGooglePlaceId')} value={place.googlePlaceId} />
                    <MetadataRow label={t('placeEdit.metaGoogleRating')} value={place.googleRating?.toString()} />
                    <MetadataRow label={t('placeEdit.metaReviewCount')} value={place.googleReviewCount?.toString()} />
                    <MetadataRow label={t('placeEdit.metaSource')} value={place.source} />
                    <MetadataRow label={t('placeEdit.metaAiVibeScore')} value={place.aiVibeScore?.toString()} />
                    <MetadataRow label={t('placeEdit.metaCreated')} value={place.createdAt ? new Date(place.createdAt).toLocaleDateString() : undefined} />
                </View>

                {/* Save button */}
                <Pressable
                    style={[styles.saveBtn, !hasDirty && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!hasDirty || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.saveBtnText}>
                            {hasDirty ? t('common.saveChanges') : t('common.noChanges')}
                        </Text>
                    )}
                </Pressable>

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

function FieldLabel({ label }: { label: string }) {
    return <Text style={styles.fieldLabel}>{label}</Text>;
}

function MetadataRow({ label, value }: { label: string; value?: string | null }) {
    const { t } = useTranslation();
    return (
        <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue}>{value ?? t('common.na')}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.bgMain,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: colors.bgMain,
    },
    content: {
        padding: 20,
        maxWidth: 640,
        alignSelf: 'center',
        width: '100%',
    },
    heroImage: {
        width: '100%',
        height: 240,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
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
    multilineInput: {
        minHeight: 80,
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
    chipText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontFamily: fonts.bodySemiBold,
    },
    chipTextActive: {
        color: '#fff',
    },
    subcategoryHint: {
        fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body, fontStyle: 'italic', marginTop: 4,
    },
    legacySubcategoryWarning: {
        fontSize: 12, color: '#f59e0b', fontFamily: fonts.bodySemiBold,
        marginBottom: 6, padding: 8, backgroundColor: 'rgba(245,158,11,0.1)',
        borderRadius: 6,
    },
    chipAdd: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.electricBlue,
        borderStyle: 'dashed',
    },
    chipAddText: {
        color: colors.electricBlue,
        fontSize: 18,
        fontFamily: fonts.bodyBold,
        lineHeight: 20,
    },
    suggestBtn: {
        alignSelf: 'flex-start',
        marginTop: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.electricBlue,
        borderRadius: borderRadius.sm,
        minWidth: 130,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestBtnDisabled: {
        opacity: 0.5,
    },
    suggestBtnText: {
        color: colors.electricBlue,
        fontSize: 13,
        fontFamily: fonts.bodyBold,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderColor,
    },
    metaLabel: {
        fontSize: 13,
        fontFamily: fonts.body,
        color: colors.textSecondary,
    },
    metaValue: {
        fontSize: 13,
        fontFamily: fonts.bodySemiBold,
        color: colors.textMain,
    },
    saveBtn: {
        backgroundColor: colors.successEmerald,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    saveBtnDisabled: {
        opacity: 0.4,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: fonts.bodyBold,
    },
    translateBtn: {
        backgroundColor: colors.electricBlue,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    translateBtnText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: fonts.bodySemiBold,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
    },
    toggleLabel: {
        fontSize: 15,
        fontFamily: fonts.bodySemiBold,
        color: colors.textMain,
    },
});
