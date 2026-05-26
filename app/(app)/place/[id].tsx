import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Image,
    Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../../src/lib/api';
import type { PlaceData, PlaceTranslateDraft } from '../../../src/types/place';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';
import { getDirtyFields as computeDirtyFields } from '../../../src/utils/getDirtyFields';
import { CATEGORIES } from '../../../src/lib/constants';
import { useTaxonomy, type SubcategoryItem } from '../../../src/hooks/useTaxonomy';
import AddSubcategoryModal from '../../../src/components/AddSubcategoryModal';

const PRICE_RANGES = ['FREE', '$', '$$', '$$$', '$$$$'] as const;
const BEST_TIMES = ['morning', 'lunch', 'afternoon', 'dinner', 'late_night'] as const;

export default function PlaceEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [place, setPlace] = useState<PlaceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable form state
    const [form, setForm] = useState<Partial<PlaceData>>({});
    const originalRef = useRef<PlaceData | null>(null);

    // Translation state
    const [translating, setTranslating] = useState(false);

    // New tag / photo inputs
    const [newTag, setNewTag] = useState('');
    const [newPhotoUrl, setNewPhotoUrl] = useState('');

    // Dynamic subcategories
    const { byCategory, refetch, createSubcategory } = useTaxonomy();
    const [addSubVisible, setAddSubVisible] = useState(false);

    // AI description suggestion
    const [suggesting, setSuggesting] = useState(false);

    const loadPlace = useCallback(async () => {
        setLoading(true);
        const res = await api<PlaceData>(`/admin/places/${id}`);
        if (res.data) {
            setPlace(res.data);
            setForm(res.data);
            originalRef.current = res.data;
        } else {
            Alert.alert('Error', `Failed to load place: ${res.error}`);
        }
        setLoading(false);
    }, [id]);

    useEffect(() => {
        loadPlace();
    }, [loadPlace]);

    const updateField = <K extends keyof PlaceData>(key: K, value: PlaceData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const getDirtyFields = (): Record<string, unknown> => {
        const original = originalRef.current;
        if (!original) return {};
        return computeDirtyFields(original, form);
    };

    const handleSave = async () => {
        const dirty = getDirtyFields();
        if (Object.keys(dirty).length === 0) {
            Alert.alert('No changes', 'Nothing to save.');
            return;
        }

        setSaving(true);
        const res = await api<PlaceData>(`/admin/places/${id}`, {
            method: 'PATCH',
            body: dirty,
        });
        setSaving(false);

        if (res.data) {
            originalRef.current = res.data;
            setForm(res.data);
            setPlace(res.data);
            Alert.alert('Saved', 'Place updated successfully.');
            router.back();
        } else {
            Alert.alert('Error', `Failed to save: ${res.error}`);
        }
    };

    // Tag management for bestFor
    const addTag = () => {
        const trimmed = newTag.trim();
        if (!trimmed) return;
        const current = form.bestFor ?? [];
        if (!current.includes(trimmed)) {
            updateField('bestFor', [...current, trimmed]);
        }
        setNewTag('');
    };

    const removeTag = (tag: string) => {
        updateField('bestFor', (form.bestFor ?? []).filter((t) => t !== tag));
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

    const handleSuggestTranslation = async () => {
        if (place?.source !== 'curated') {
            Alert.alert('Not curated', 'Translation is only available for curated places.');
            return;
        }
        setTranslating(true);
        const res = await api<PlaceTranslateDraft>(`/admin/places/${id}/translate`, { method: 'POST' });
        setTranslating(false);
        if (res.data) {
            setForm(prev => ({
                ...prev,
                nameEs: res.data!.nameEs ?? prev.nameEs,
                whyThisPlaceEs: res.data!.whyThisPlaceEs ?? prev.whyThisPlaceEs,
                bestTimeEs: res.data!.bestTimeEs ?? prev.bestTimeEs,
                neighborhoodEs: res.data!.neighborhoodEs ?? prev.neighborhoodEs,
                subcategoriesEs: res.data!.subcategoriesEs ?? prev.subcategoriesEs,
                bestForEs: res.data!.bestForEs ?? prev.bestForEs,
                suitableForEs: res.data!.suitableForEs ?? prev.suitableForEs,
            }));
        } else {
            Alert.alert('Error', `Translation failed: ${res.error}`);
        }
    };

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
                <Text style={{ color: colors.error, fontFamily: fonts.body }}>Place not found</Text>
            </View>
        );
    }

    const hasDirty = Object.keys(getDirtyFields()).length > 0;

    return (
        <>
            <Stack.Screen
                options={{
                    title: form.name || 'Edit Place',
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
                        <Text style={{ color: colors.textSecondary, fontFamily: fonts.body }}>No photo</Text>
                    </View>
                )}

                {/* Section: Identity */}
                <Text style={styles.sectionTitle}>Identity</Text>
                <View style={styles.section}>
                    <FieldLabel label="Name" />
                    <TextInput
                        style={styles.input}
                        value={form.name ?? ''}
                        onChangeText={(v) => updateField('name', v)}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="Category" />
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

                    <FieldLabel label="Subcategories" />
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
                                                Legacy: "{legacyItems.join(', ')}" — pick canonical below
                                            </Text>
                                        )}
                                        {dynamicSubs.length === 0 && legacyItems.length === 0 && (
                                            <Text style={styles.subcategoryHint}>
                                                No subcategories for {form.category}. Tap "+ Add" to create one.
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
                                                <Text style={styles.chipAddText}>+ Add</Text>
                                            </Pressable>
                                        </View>
                                        <AddSubcategoryModal
                                            visible={addSubVisible}
                                            categoryKey={form.category!}
                                            onConfirm={async (payload) => {
                                                const newSub = await createSubcategory({ categoryKey: form.category!, ...payload });
                                                setAddSubVisible(false);
                                                if (newSub) {
                                                    await refetch();
                                                    updateField('subcategories', [...selected, newSub.key]);
                                                }
                                            }}
                                            onCancel={() => setAddSubVisible(false)}
                                        />
                                    </>
                                );
                            })()}
                        </>
                    ) : (
                        <Text style={styles.subcategoryHint}>Select a category first</Text>
                    )}

                    <FieldLabel label="Why This Place" />
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
                        onPress={async () => {
                            setSuggesting(true);
                            const res = await api<{ whyThisPlace: string }>(`/admin/places/${id}/suggest-description`, { method: 'POST' });
                            setSuggesting(false);
                            if (res.data?.whyThisPlace) {
                                updateField('whyThisPlace', res.data.whyThisPlace);
                            } else {
                                Alert.alert('Error', res.error ?? 'Could not generate description.');
                            }
                        }}
                    >
                        {suggesting
                            ? <ActivityIndicator size="small" color={colors.textSecondary} />
                            : <Text style={styles.suggestBtnText}>Suggest with AI</Text>
                        }
                    </Pressable>
                </View>

                {/* Section: Location */}
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.section}>
                    <FieldLabel label="Neighborhood" />
                    <TextInput
                        style={styles.input}
                        value={form.neighborhood ?? ''}
                        onChangeText={(v) => updateField('neighborhood', v)}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="City" />
                    <TextInput
                        style={styles.input}
                        value={form.city ?? ''}
                        onChangeText={(v) => updateField('city', v)}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <View style={styles.row}>
                        <View style={styles.halfField}>
                            <FieldLabel label="Latitude" />
                            <TextInput
                                style={styles.input}
                                value={form.latitude?.toString() ?? ''}
                                onChangeText={(v) => updateField('latitude', v ? parseFloat(v) : undefined)}
                                keyboardType="decimal-pad"
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>
                        <View style={styles.halfField}>
                            <FieldLabel label="Longitude" />
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
                <Text style={styles.sectionTitle}>Curation</Text>
                <View style={styles.section}>
                    <FieldLabel label="Best For" />
                    <View style={styles.chipRow}>
                        {(form.bestFor ?? []).map((tag) => (
                            <Pressable key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                                <Text style={styles.tagChipText}>{tag} ×</Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.addRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={newTag}
                            onChangeText={setNewTag}
                            placeholder="Add tag..."
                            placeholderTextColor={colors.textSecondary}
                            onSubmitEditing={addTag}
                            returnKeyType="done"
                        />
                        <Pressable style={styles.addBtn} onPress={addTag}>
                            <Text style={styles.addBtnText}>+</Text>
                        </Pressable>
                    </View>

                    <FieldLabel label="Best Time" />
                    <View style={styles.chipRow}>
                        {BEST_TIMES.map((time) => (
                            <Pressable
                                key={time}
                                style={[styles.chip, form.bestTime === time && styles.chipActive]}
                                onPress={() => updateField('bestTime', form.bestTime === time ? undefined : time)}
                            >
                                <Text
                                    style={[styles.chipText, form.bestTime === time && styles.chipTextActive]}
                                >
                                    {time}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label="Price Range" />
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

                    <FieldLabel label="Visit Duration (min) — overrides category default" />
                    <TextInput
                        style={styles.input}
                        value={form.visitDurationMin != null ? form.visitDurationMin.toString() : ''}
                        onChangeText={(v) => updateField('visitDurationMin', v ? parseInt(v, 10) || null : null)}
                        keyboardType="number-pad"
                        placeholder="Leave blank to use category default"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                {/* Section: Photos */}
                <Text style={styles.sectionTitle}>Photos</Text>
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
                            placeholder="Paste photo URL..."
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

                {/* Section: Translations (ES) — curated only */}
                {place?.source === 'curated' && (
                    <>
                        <Text style={styles.sectionTitle}>Translation ES</Text>
                        <View style={styles.section}>
                            <Pressable
                                style={[styles.translateBtn, translating && styles.saveBtnDisabled]}
                                onPress={handleSuggestTranslation}
                                disabled={translating}
                            >
                                {translating
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.translateBtnText}>Suggest ES Translation (Gemini)</Text>
                                }
                            </Pressable>

                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>Approved ES</Text>
                                <Switch
                                    value={form.translationStatusEs === 'approved'}
                                    onValueChange={(v) => updateField('translationStatusEs', v ? 'approved' : 'draft')}
                                    trackColor={{ false: colors.borderColor, true: colors.successEmerald }}
                                />
                            </View>

                            <FieldLabel label="Name (ES)" />
                            <TextInput
                                style={styles.input}
                                value={form.nameEs ?? ''}
                                onChangeText={(v) => updateField('nameEs', v || null)}
                                placeholder={form.name}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label="Why This Place (ES)" />
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                value={form.whyThisPlaceEs ?? ''}
                                onChangeText={(v) => updateField('whyThisPlaceEs', v || null)}
                                placeholder={form.whyThisPlace ?? ''}
                                placeholderTextColor={colors.textSecondary}
                                multiline numberOfLines={3} textAlignVertical="top"
                            />

                            <FieldLabel label="Best Time (ES)" />
                            <TextInput
                                style={styles.input}
                                value={form.bestTimeEs ?? ''}
                                onChangeText={(v) => updateField('bestTimeEs', v || null)}
                                placeholder={form.bestTime ?? ''}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label="Neighborhood (ES)" />
                            <TextInput
                                style={styles.input}
                                value={form.neighborhoodEs ?? ''}
                                onChangeText={(v) => updateField('neighborhoodEs', v || null)}
                                placeholder={form.neighborhood ?? ''}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label="Subcategories (ES), comma separated" />
                            <TextInput
                                style={styles.input}
                                value={form.subcategoriesEs?.join(', ') ?? ''}
                                onChangeText={(v) => updateField('subcategoriesEs', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)}
                                placeholder={(form.subcategories ?? []).join(', ')}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label="Best For (ES), comma separated" />
                            <TextInput
                                style={styles.input}
                                value={form.bestForEs?.join(', ') ?? ''}
                                onChangeText={(v) => updateField('bestForEs', v ? v.split(',').map(s => s.trim()).filter(Boolean) : null)}
                                placeholder={(form.bestFor ?? []).join(', ')}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label="Suitable For (ES), comma separated" />
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
                <Text style={styles.sectionTitle}>Metadata</Text>
                <View style={styles.section}>
                    <MetadataRow label="Status" value={place.status} />
                    <MetadataRow label="Google Place ID" value={place.googlePlaceId} />
                    <MetadataRow label="Google Rating" value={place.googleRating?.toString()} />
                    <MetadataRow label="Review Count" value={place.googleReviewCount?.toString()} />
                    <MetadataRow label="Source" value={place.source} />
                    <MetadataRow label="AI Vibe Score" value={place.aiVibeScore?.toString()} />
                    <MetadataRow label="Created" value={place.createdAt ? new Date(place.createdAt).toLocaleDateString() : undefined} />
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
                            {hasDirty ? 'Save Changes' : 'No Changes'}
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
    return (
        <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue}>{value ?? '—'}</Text>
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
    subcategoryHint: {
        fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body, fontStyle: 'italic', marginTop: 4,
    },
    legacySubcategoryWarning: {
        fontSize: 12, color: '#f59e0b', fontFamily: fonts.bodySemiBold,
        marginBottom: 6, padding: 8, backgroundColor: 'rgba(245,158,11,0.1)',
        borderRadius: 6,
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
