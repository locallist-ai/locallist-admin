import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../../src/lib/dialogs';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/lib/api';
import type { PlaceData } from '../../../src/types/place';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';
import { CATEGORIES, STATUSES } from '../../../src/lib/constants';
import { useTaxonomy } from '../../../src/hooks/useTaxonomy';
import PlaceFormFields from '../../../src/components/PlaceFormFields';

export default function PlaceCreateScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const { byCategory } = useTaxonomy();

    const [form, setForm] = useState<Partial<PlaceData>>({
        city: 'Miami',
        status: 'published',
    });

    const [newPhotoUrl, setNewPhotoUrl] = useState('');

    const updateField = <K extends keyof PlaceData>(key: K, value: PlaceData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleCreate = async () => {
        if (!form.name?.trim()) {
            showAlert(t('common.required'), t('placeCreate.nameRequired'));
            return;
        }
        if (!form.category) {
            showAlert(t('common.required'), t('placeCreate.categoryRequired'));
            return;
        }
        if (!form.whyThisPlace?.trim()) {
            showAlert(t('common.required'), t('placeCreate.whyRequired'));
            return;
        }

        setSaving(true);
        const res = await api<PlaceData>('/admin/places', {
            method: 'POST',
            body: {
                name: form.name.trim(),
                category: form.category,
                whyThisPlace: form.whyThisPlace.trim(),
                subcategories: form.subcategories?.length ? form.subcategories : undefined,
                neighborhood: form.neighborhood?.trim() || undefined,
                city: form.city?.trim() || 'Miami',
                latitude: form.latitude,
                longitude: form.longitude,
                bestFor: form.bestFor,
                bestTimes: form.bestTimes,
                priceRange: form.priceRange,
                photos: form.photos,
                status: form.status || 'published',
            },
        });
        setSaving(false);

        if (res.data) {
            showAlert(t('placeCreate.createdTitle'), t('placeCreate.createdMsg', { name: res.data.name }));
            router.back();
        } else {
            showAlert(t('common.error'), t('placeCreate.createFailed', { error: res.error ?? '' }));
        }
    };

    // bestFor: predefined multi-select chips (legacy free-form values stay removable).
    const toggleBestFor = (tag: string) => {
        const current = form.bestFor ?? [];
        updateField('bestFor', current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
    };

    const removeTag = (tag: string) => {
        updateField('bestFor', (form.bestFor ?? []).filter((t) => t !== tag));
    };

    // bestTimes: multi-select chips over the fixed BEST_TIMES list.
    const toggleBestTime = (time: string) => {
        const current = form.bestTimes ?? [];
        updateField('bestTimes', current.includes(time) ? current.filter((t) => t !== time) : [...current, time]);
    };

    // Photo management
    const addPhoto = () => {
        const trimmed = newPhotoUrl.trim();
        if (!trimmed) return;
        const current = form.photos ?? [];
        updateField('photos', [...current, trimmed]);
        setNewPhotoUrl('');
    };

    const removePhoto = (url: string) => {
        updateField('photos', (form.photos ?? []).filter((p) => p !== url));
    };

    const isValid = !!(form.name?.trim() && form.category && form.whyThisPlace?.trim());

    return (
        <>
            <Stack.Screen
                options={{
                    title: t('nav.createPlace'),
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Section: Identity */}
                <Text style={styles.sectionTitle}>{t('place.sectionIdentity')}</Text>
                <View style={styles.section}>
                    <FieldLabel label={t('placeCreate.nameLabel')} />
                    <TextInput
                        style={styles.input}
                        value={form.name ?? ''}
                        onChangeText={(v) => updateField('name', v)}
                        placeholder={t('placeCreate.namePlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('placeCreate.categoryLabel')} />
                    <View style={styles.chipRow}>
                        {CATEGORIES.map((cat) => (
                            <Pressable
                                key={cat}
                                style={[styles.chip, form.category === cat && styles.chipActive]}
                                onPress={() => updateField('category', cat)}
                            >
                                <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>
                                    {cat}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label={t('place.subcategories')} />
                    {form.category ? (
                        <View style={styles.chipRow}>
                            {(byCategory[form.category] ?? []).map((sub) => {
                                const isActive = (form.subcategories ?? []).some((s) => s.toLowerCase() === sub.key.toLowerCase());
                                return (
                                    <Pressable
                                        key={sub.key}
                                        style={[styles.chip, isActive && styles.chipActive]}
                                        onPress={() => {
                                            const current = form.subcategories ?? [];
                                            const next = isActive
                                                ? current.filter((s) => s.toLowerCase() !== sub.key.toLowerCase())
                                                : [...current, sub.key];
                                            updateField('subcategories', next);
                                        }}
                                    >
                                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                            {sub.labelEn}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : (
                        <Text style={styles.subcategoryHint}>{t('place.selectCategoryFirst')}</Text>
                    )}

                    <FieldLabel label={t('placeCreate.whyLabel')} />
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={form.whyThisPlace ?? ''}
                        onChangeText={(v) => updateField('whyThisPlace', v)}
                        placeholder={t('placeCreate.whyPlaceholder')}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        placeholderTextColor={colors.textSecondary}
                    />
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
                    neighborhoodPlaceholder={t('placeCreate.neighborhoodPlaceholder')}
                    curationExtra={
                        <>
                            <FieldLabel label={t('placeEdit.metaStatus')} />
                            <View style={styles.chipRow}>
                                {STATUSES.map((s) => (
                                    <Pressable
                                        key={s}
                                        style={[styles.chip, form.status === s && styles.chipActive]}
                                        onPress={() => updateField('status', s)}
                                    >
                                        <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>
                                            {s}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    }
                />

                {/* Create button */}
                <Pressable
                    style={[styles.createBtn, !isValid && styles.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!isValid || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.createBtnText}>{t('nav.createPlace')}</Text>
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgMain },
    content: { padding: 20, maxWidth: 640, alignSelf: 'center', width: '100%' },
    sectionTitle: {
        fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.electricBlue,
        textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm,
    },
    section: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.borderColor,
    },
    fieldLabel: {
        fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textSecondary,
        marginBottom: 6, marginTop: spacing.md,
    },
    input: {
        backgroundColor: colors.bgMain, borderRadius: borderRadius.sm, padding: spacing.md,
        color: colors.textMain, fontFamily: fonts.body, fontSize: 15,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    multilineInput: { minHeight: 80 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    chipActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    chipText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bodySemiBold },
    chipTextActive: { color: '#fff' },
    subcategoryHint: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body, fontStyle: 'italic', marginTop: 4 },
    createBtn: {
        backgroundColor: colors.successEmerald, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl,
    },
    createBtnDisabled: { opacity: 0.4 },
    createBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.bodyBold },
});
