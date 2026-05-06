import React, { useState } from 'react';
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
    FlatList,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { api } from '../../../src/lib/api';
import type { GooglePlacePreview, GoogleSearchResponse } from '../../../src/types/place';
import type { PlaceData } from '../../../src/types/place';
import { CATEGORIES, inferSubcategoryFromGoogleTypes } from '../../../src/lib/constants';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';

export default function ImportGoogleScreen() {
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

    const handleSearch = async () => {
        const q = query.trim();
        if (!q) {
            Alert.alert('Required', 'Enter a keyword to search.');
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
            Alert.alert('Error', res.error ?? 'Search failed. Check that the Google Places API key is configured.');
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

    const handleImport = async () => {
        if (selected.size === 0) return;
        if (!category) {
            Alert.alert('Required', 'Choose a category before importing.');
            return;
        }

        const toImport = results
            .filter((r) => selected.has(r.googlePlaceId) && !r.existsInLib)
            .map<Partial<PlaceData>>((r) => {
                const inferredSub = inferSubcategoryFromGoogleTypes(category!, r.types ?? [], r.name);
                const subcategory = subcategoryOverrides[r.googlePlaceId] !== undefined
                    ? subcategoryOverrides[r.googlePlaceId] ?? undefined
                    : inferredSub ?? undefined;
                return {
                    name: r.name,
                    category,
                    subcategory,
                    whyThisPlace: 'Importado desde Google Places — pendiente de redacción curatorial',
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
            Alert.alert('Nothing to import', 'All selected places are already in the library.');
            return;
        }

        setImporting(true);
        const res = await api('/admin/places/bulk', { method: 'POST', body: toImport });
        setImporting(false);

        if (res.data) {
            const { created, skipped, errors } = res.data as { created: number; skipped: number; errors: number };
            Alert.alert(
                'Import complete',
                `${created} added · ${skipped} skipped (already exists) · ${errors} errors`,
                [{ text: 'Done', onPress: () => router.back() }]
            );
        } else {
            Alert.alert('Error', res.error ?? 'Import failed.');
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
                    title: 'Import from Google',
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Search */}
                <Text style={styles.sectionTitle}>Search</Text>
                <View style={styles.section}>
                    <FieldLabel label="Keyword" />
                    <TextInput
                        style={styles.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="e.g. ramen, rooftop bar, pilates studio"
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    <FieldLabel label="City" />
                    <TextInput
                        style={styles.input}
                        value={city}
                        onChangeText={setCity}
                        placeholder="Miami"
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
                            <Text style={styles.searchBtnText}>Search Google Places</Text>
                        )}
                    </Pressable>
                </View>

                {/* Category */}
                <Text style={styles.sectionTitle}>Category for import</Text>
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
                                ? `${results.length} results — tap to select`
                                : 'No results'}
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
                                    suggestedSubcategory={activeSub}
                                    onSubcategoryChange={
                                        category
                                            ? (sub) => setSubcategoryOverride(place.googlePlaceId, sub)
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
                                {selectedCount > 0 ? `Import ${selectedCount} selected` : 'Select places to import'}
                            </Text>
                        )}
                    </Pressable>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );
}

function PlaceResultCard({
    place,
    isSelected,
    onToggle,
    suggestedSubcategory,
    onSubcategoryChange,
}: {
    place: GooglePlacePreview;
    isSelected: boolean;
    onToggle: () => void;
    suggestedSubcategory?: string | null;
    onSubcategoryChange?: (sub: string | null) => void;
}) {
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
                            <Text style={styles.inLibBadgeText}>In library</Text>
                        </View>
                    )}
                </View>
                {place.formattedAddress ? (
                    <Text style={styles.resultAddress} numberOfLines={1}>{place.formattedAddress}</Text>
                ) : null}
                <View style={styles.resultMeta}>
                    {place.rating != null && (
                        <Text style={styles.metaText}>★ {place.rating.toFixed(1)}</Text>
                    )}
                    {place.reviewCount != null && (
                        <Text style={styles.metaText}>({place.reviewCount.toLocaleString()})</Text>
                    )}
                    {place.priceLevel != null && (
                        <Text style={styles.metaText}>{place.priceLevel}</Text>
                    )}
                    {suggestedSubcategory && onSubcategoryChange && !place.existsInLib && (
                        <Pressable
                            style={styles.subBadge}
                            onPress={(e) => { e.stopPropagation?.(); onSubcategoryChange(suggestedSubcategory ? null : null); }}
                        >
                            <Text style={styles.subBadgeText}>{suggestedSubcategory} ✎</Text>
                        </Pressable>
                    )}
                </View>
            </View>
            {!place.existsInLib && (
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
    resultAddress: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.body, marginBottom: 4 },
    resultMeta: { flexDirection: 'row', gap: 6 },
    metaText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bodyMedium },
    checkbox: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderColor,
        marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    checkmark: { color: '#fff', fontSize: 14, fontFamily: fonts.bodyBold },
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
});
