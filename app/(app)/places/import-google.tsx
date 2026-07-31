import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Image,
    ActionSheetIOS,
    Platform,
    Modal,
} from 'react-native';
import { showAlert } from '../../../src/lib/dialogs';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/lib/api';
import type { GooglePlacePreview, GoogleSearchResponse, PlaceData } from '../../../src/types/place';
import { CATEGORIES, getSubcategories, inferSubcategoryFromGoogleTypes } from '../../../src/lib/constants';
import { useTaxonomy } from '../../../src/hooks/useTaxonomy';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ImportGoogleScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [city, setCity] = useState('Miami');
    const [category, setCategory] = useState<string | null>(null);
    const [results, setResults] = useState<GooglePlacePreview[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [searched, setSearched] = useState(false);
    // Per-place subcategory overrides (googlePlaceId → subcategory)
    const [subcategoryOverrides, setSubcategoryOverrides] = useState<Record<string, string | null>>({});
    // Place whose subcategory is being picked via the modal (non-iOS fallback)
    const [pickerTarget, setPickerTarget] = useState<string | null>(null);
    // Live taxonomy from the API, so subcategories created in the place editor
    // show up here too (the static list only knows the seed taxonomy).
    const { byCategory } = useTaxonomy();

    const subcategoryOptions = (cat: string): { key: string; label: string }[] => {
        const dynamic = byCategory[cat] ?? [];
        if (dynamic.length > 0) return dynamic.map((s) => ({ key: s.key, label: s.labelEn }));
        // Fallback while the taxonomy hasn't loaded: static labels are also
        // accepted by the API (it matches key OR labelEn, case-insensitive).
        return getSubcategories(cat).map((label) => ({ key: label, label }));
    };

    const subcategoryLabel = (cat: string | null, value: string | null | undefined): string | null => {
        if (!cat || !value) return value ?? null;
        return subcategoryOptions(cat).find((o) => o.key === value)?.label ?? value;
    };

    const handleSearch = async () => {
        const q = query.trim();
        if (!q) {
            showAlert(t('common.required'), t('importGoogle.enterKeyword'));
            return;
        }
        setLoading(true);
        setResults([]);
        setSelected(new Set());
        setSubcategoryOverrides({});
        setSearched(false);

        const res = await api<GoogleSearchResponse>('/admin/places/google-search', {
            method: 'POST',
            body: { query: q, city: city.trim() || 'Miami' },
        });

        setLoading(false);
        setSearched(true);

        if (res.data) {
            setResults(res.data.results);
        } else {
            showAlert(t('common.error'), res.error ?? t('importGoogle.searchFailed'));
        }
    };

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const setSubcategoryOverride = (googlePlaceId: string, sub: string | null) => {
        setSubcategoryOverrides((prev) => ({ ...prev, [googlePlaceId]: sub }));
    };

    const openSubcategoryPicker = (googlePlaceId: string) => {
        if (!category) return;
        if (Platform.OS === 'ios') {
            const subs = subcategoryOptions(category);
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: t('importGoogle.subcategory'),
                    options: [t('common.cancel'), t('importGoogle.noSubcategory'), ...subs.map((s) => s.label)],
                    cancelButtonIndex: 0,
                },
                (idx) => {
                    if (idx === 1) setSubcategoryOverride(googlePlaceId, null);
                    else if (idx >= 2) setSubcategoryOverride(googlePlaceId, subs[idx - 2].key);
                },
            );
        } else {
            // Android/web: Alert can't render 16+ scrollable options — use a modal
            setPickerTarget(googlePlaceId);
        }
    };

    const handlePickerSelect = (sub: string | null) => {
        if (pickerTarget) setSubcategoryOverride(pickerTarget, sub);
        setPickerTarget(null);
    };

    const handleImport = async () => {
        if (selected.size === 0) return;
        if (!category) {
            showAlert(t('common.required'), t('importGoogle.chooseCategory'));
            return;
        }

        const toImport = results
            .filter((r) => selected.has(r.googlePlaceId) && !r.existsInLib)
            .map<Partial<PlaceData>>((r) => {
                const inferredSub = inferSubcategoryFromGoogleTypes(category!, r.types ?? [], r.name);
                const resolvedSub = subcategoryOverrides[r.googlePlaceId] !== undefined
                    ? subcategoryOverrides[r.googlePlaceId] ?? undefined
                    : inferredSub ?? undefined;
                return {
                    name: r.name,
                    category,
                    subcategories: resolvedSub ? [resolvedSub] : undefined,
                    whyThisPlace: r.editorialSummary,
                    city: city.trim() || 'Miami',
                    latitude: r.lat,
                    longitude: r.lng,
                    googlePlaceId: r.googlePlaceId,
                    googleRating: r.rating,
                    googleReviewCount: r.reviewCount,
                    priceRange: r.priceLevel ?? undefined,
                    photos: r.photos,
                    sourceUrl: r.website,
                    source: 'google',
                    status: 'in_review',
                };
            });

        if (toImport.length === 0) {
            showAlert(t('importGoogle.nothingTitle'), t('importGoogle.nothingMsg'));
            return;
        }

        setImporting(true);
        const res = await api('/admin/places/bulk', { method: 'POST', body: toImport });
        setImporting(false);

        if (res.data) {
            const { created, skipped, errors } = res.data as { created: number; skipped: number; errors: number };
            showAlert(
                t('importGoogle.completeTitle'),
                t('importGoogle.completeMsg', { created: String(created), skipped: String(skipped), errors: String(errors) }),
                [{ text: t('common.done'), onPress: () => router.back() }]
            );
        } else {
            showAlert(t('common.error'), res.error ?? t('importGoogle.importFailed'));
        }
    };

    const selectedCount = [...selected].filter((id) => {
        const r = results.find((p) => p.googlePlaceId === id);
        return r && !r.existsInLib;
    }).length;

    return (
        <>
            <Stack.Screen
                options={{
                    title: t('nav.importGoogle'),
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Search */}
                <Text style={styles.sectionTitle}>{t('importGoogle.search')}</Text>
                <View style={styles.section}>
                    <FieldLabel label={t('importGoogle.keyword')} />
                    <TextInput
                        style={styles.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t('importGoogle.keywordPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    <FieldLabel label={t('place.city')} />
                    <TextInput
                        style={styles.input}
                        value={city}
                        onChangeText={setCity}
                        placeholder={t('common.cityPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="done"
                    />
                    <Pressable
                        style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
                        onPress={handleSearch}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.searchBtnText}>{t('importGoogle.searchGoogle')}</Text>
                        )}
                    </Pressable>
                </View>

                {/* Category */}
                <Text style={styles.sectionTitle}>{t('importGoogle.categoryForImport')}</Text>
                <View style={styles.section}>
                    <View style={styles.chipRow}>
                        {CATEGORIES.map((cat) => (
                            <Pressable
                                key={cat}
                                style={[styles.chip, category === cat && styles.chipActive]}
                                onPress={() => setCategory(category === cat ? null : cat)}
                            >
                                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                                    {cat}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Results */}
                {searched && (
                    <>
                        <Text style={styles.sectionTitle}>
                            {results.length > 0
                                ? t('importGoogle.resultsCount', { count: results.length })
                                : t('importGoogle.noResults')}
                        </Text>
                        {results.map((place) => {
                            const inferred = category
                                ? inferSubcategoryFromGoogleTypes(category, place.types ?? [], place.name)
                                : null;
                            const override = subcategoryOverrides[place.googlePlaceId];
                            const activeSub = override !== undefined ? override : inferred;
                            return (
                                <PlaceResultCard
                                    key={place.googlePlaceId}
                                    place={place}
                                    isSelected={selected.has(place.googlePlaceId)}
                                    onToggle={() => !place.existsInLib && toggleSelect(place.googlePlaceId)}
                                    suggestedSubcategory={subcategoryLabel(category, activeSub)}
                                    onEditSubcategory={
                                        category
                                            ? () => openSubcategoryPicker(place.googlePlaceId)
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </>
                )}

                {/* Import button */}
                {searched && results.length > 0 && (
                    <Pressable
                        style={[styles.importBtn, (selectedCount === 0 || !category || importing) && styles.importBtnDisabled]}
                        onPress={handleImport}
                        disabled={selectedCount === 0 || !category || importing}
                    >
                        {importing ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.importBtnText}>
                                {selectedCount > 0 ? t('importGoogle.importSelected', { count: selectedCount }) : t('importGoogle.selectToImport')}
                            </Text>
                        )}
                    </Pressable>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Subcategory picker (non-iOS fallback, scrollable) */}
            <Modal
                visible={pickerTarget !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerTarget(null)}
            >
                <Pressable style={styles.pickerOverlay} onPress={() => setPickerTarget(null)}>
                    <Pressable style={styles.pickerCard} onPress={() => {}}>
                        <Text style={styles.pickerTitle}>{t('importGoogle.subcategory')}</Text>
                        <ScrollView style={styles.pickerList}>
                            <Pressable style={styles.pickerOption} onPress={() => handlePickerSelect(null)}>
                                <Text style={styles.pickerOptionMuted}>{t('importGoogle.noSubcategory')}</Text>
                            </Pressable>
                            {(category ? subcategoryOptions(category) : []).map((sub) => (
                                <Pressable
                                    key={sub.key}
                                    style={styles.pickerOption}
                                    onPress={() => handlePickerSelect(sub.key)}
                                >
                                    <Text style={styles.pickerOptionText}>{sub.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <Pressable style={styles.pickerCancel} onPress={() => setPickerTarget(null)}>
                            <Text style={styles.pickerCancelText}>{t('common.cancel')}</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

function PlaceResultCard({
    place,
    isSelected,
    onToggle,
    suggestedSubcategory,
    onEditSubcategory,
}: {
    place: GooglePlacePreview;
    isSelected: boolean;
    onToggle: () => void;
    suggestedSubcategory?: string | null;
    onEditSubcategory?: () => void;
}) {
    const { t } = useTranslation();
    const thumb = place.photos[0];
    return (
        <Pressable
            style={[
                styles.resultCard,
                isSelected && styles.resultCardSelected,
                place.existsInLib && styles.resultCardDisabled,
            ]}
            onPress={onToggle}
        >
            {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
            ) : (
                <View style={[styles.thumb, { backgroundColor: colors.borderColor }]} />
            )}
            <View style={styles.resultInfo}>
                <View style={styles.resultNameRow}>
                    <Text style={styles.resultName} numberOfLines={1}>{place.name}</Text>
                    {place.existsInLib && (
                        <View style={styles.inLibBadge}>
                            <Text style={styles.inLibBadgeText}>{t('importGoogle.inLibrary')}</Text>
                        </View>
                    )}
                </View>
                {place.formattedAddress ? (
                    <Text style={styles.resultAddress} numberOfLines={1}>{place.formattedAddress}</Text>
                ) : null}
                {place.editorialSummary ? (
                    <Text style={styles.resultEditorial} numberOfLines={2}>{place.editorialSummary}</Text>
                ) : null}
                <View style={styles.resultMeta}>
                    {place.rating != null && (
                        <Text style={styles.metaText}>
                            <MaterialCommunityIcons name="star" size={12} color={colors.textSecondary} />
                            {' '}{place.rating.toFixed(1)}
                        </Text>
                    )}
                    {place.reviewCount != null && (
                        <Text style={styles.metaText}>({place.reviewCount.toLocaleString()})</Text>
                    )}
                    {place.priceLevel != null && (
                        <Text style={styles.metaText}>{place.priceLevel}</Text>
                    )}
                    {onEditSubcategory && !place.existsInLib && (
                        <Pressable
                            style={styles.subBadge}
                            onPress={(e) => { e.stopPropagation?.(); onEditSubcategory(); }}
                        >
                            <Text style={styles.subBadgeText}>
                                {suggestedSubcategory ? (
                                    <>
                                        {suggestedSubcategory}{' '}
                                        <MaterialCommunityIcons name="pencil" size={10} color="#6366f1" />
                                    </>
                                ) : (
                                    t('importGoogle.addSubcategory')
                                )}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
            {!place.existsInLib && (
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                </View>
            )}
        </Pressable>
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
    searchBtn: {
        backgroundColor: colors.electricBlue, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md,
    },
    searchBtnDisabled: { opacity: 0.5 },
    searchBtnText: { color: '#fff', fontSize: 15, fontFamily: fonts.bodyBold },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    chipActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    chipText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bodySemiBold },
    chipTextActive: { color: '#fff' },
    resultCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.borderColor,
        marginBottom: spacing.sm, overflow: 'hidden',
    },
    resultCardSelected: { borderColor: colors.electricBlue, borderWidth: 2 },
    resultCardDisabled: { opacity: 0.5 },
    thumb: { width: 72, height: 72 },
    resultInfo: { flex: 1, padding: spacing.sm },
    resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    resultName: { flex: 1, fontSize: 15, fontFamily: fonts.bodyBold, color: colors.textMain },
    inLibBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    inLibBadgeText: { fontSize: 10, fontFamily: fonts.bodySemiBold, color: colors.electricBlue },
    resultAddress: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.body, marginBottom: 2 },
    resultEditorial: { fontSize: 12, color: colors.textMain, fontFamily: fonts.body, fontStyle: 'italic', marginBottom: 4, opacity: 0.85 },
    resultMeta: { flexDirection: 'row', gap: 6 },
    metaText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bodyMedium },
    checkbox: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderColor,
        marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    importBtn: {
        backgroundColor: colors.successEmerald, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg,
    },
    importBtnDisabled: { opacity: 0.4 },
    importBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.bodyBold },
    subBadge: {
        backgroundColor: 'rgba(99,102,241,0.12)', paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 10, marginLeft: 4,
    },
    subBadgeText: { fontSize: 10, fontFamily: fonts.bodySemiBold, color: '#6366f1' },
    pickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
    },
    pickerCard: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.lg, padding: spacing.lg,
        width: '100%', maxWidth: 400, maxHeight: '70%',
    },
    pickerTitle: {
        fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.textMain,
        marginBottom: spacing.sm,
    },
    // Numeric maxHeight on the list itself: percentage clamps on the card can
    // fail to bound the ScrollView on large screens, leaving it unscrollable.
    // flexShrink still lets it shrink further when the card hits its own clamp.
    pickerList: { flexGrow: 0, flexShrink: 1, maxHeight: 380 },
    pickerOption: {
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderColor,
    },
    pickerOptionText: { fontSize: 15, fontFamily: fonts.body, color: colors.textMain },
    pickerOptionMuted: { fontSize: 15, fontFamily: fonts.body, color: colors.textSecondary, fontStyle: 'italic' },
    pickerCancel: { alignItems: 'center', paddingTop: spacing.md },
    pickerCancelText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
});
