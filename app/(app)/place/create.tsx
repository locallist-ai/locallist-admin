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
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { api } from '../../../src/lib/api';
import type { PlaceData } from '../../../src/types/place';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';
import { CATEGORIES, PRICE_RANGES, BEST_TIMES, STATUSES } from '../../../src/lib/constants';

export default function PlaceCreateScreen() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<Partial<PlaceData>>({
        city: 'Miami',
        status: 'published',
    });

    const [newTag, setNewTag] = useState('');
    const [newPhotoUrl, setNewPhotoUrl] = useState('');

    const updateField = <K extends keyof PlaceData>(key: K, value: PlaceData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleCreate = async () => {
        if (!form.name?.trim()) {
            Alert.alert('Required', 'Name is required.');
            return;
        }
        if (!form.category) {
            Alert.alert('Required', 'Category is required.');
            return;
        }
        if (!form.whyThisPlace?.trim()) {
            Alert.alert('Required', 'Why This Place is required.');
            return;
        }

        setSaving(true);
        const res = await api<PlaceData>('/admin/places', {
            method: 'POST',
            body: {
                name: form.name.trim(),
                category: form.category,
                whyThisPlace: form.whyThisPlace.trim(),
                subcategory: form.subcategory?.trim() || undefined,
                neighborhood: form.neighborhood?.trim() || undefined,
                city: form.city?.trim() || 'Miami',
                latitude: form.latitude,
                longitude: form.longitude,
                bestFor: form.bestFor,
                bestTime: form.bestTime,
                priceRange: form.priceRange,
                photos: form.photos,
                status: form.status || 'published',
            },
        });
        setSaving(false);

        if (res.data) {
            Alert.alert('Created', `${res.data.name} created successfully.`);
            router.back();
        } else {
            Alert.alert('Error', `Failed to create: ${res.error}`);
        }
    };

    // Tag management
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

    const isValid = !!(form.name?.trim() && form.category && form.whyThisPlace?.trim());

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Create Place',
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Section: Identity */}
                <Text style={styles.sectionTitle}>Identity</Text>
                <View style={styles.section}>
                    <FieldLabel label="Name *" />
                    <TextInput
                        style={styles.input}
                        value={form.name ?? ''}
                        onChangeText={(v) => updateField('name', v)}
                        placeholder="Place name"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="Category *" />
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

                    <FieldLabel label="Subcategory" />
                    <TextInput
                        style={styles.input}
                        value={form.subcategory ?? ''}
                        onChangeText={(v) => updateField('subcategory', v)}
                        placeholder="e.g. Speakeasy cocktail bar"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="Why This Place *" />
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={form.whyThisPlace ?? ''}
                        onChangeText={(v) => updateField('whyThisPlace', v)}
                        placeholder="What makes this place special?"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                {/* Section: Location */}
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.section}>
                    <FieldLabel label="Neighborhood" />
                    <TextInput
                        style={styles.input}
                        value={form.neighborhood ?? ''}
                        onChangeText={(v) => updateField('neighborhood', v)}
                        placeholder="e.g. Wynwood"
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
                                <Text style={[styles.chipText, form.bestTime === time && styles.chipTextActive]}>
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
                                style={[styles.chip, form.priceRange === pr && styles.chipActive]}
                                onPress={() => updateField('priceRange', pr)}
                            >
                                <Text style={[styles.chipText, form.priceRange === pr && styles.chipTextActive]}>
                                    {pr}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label="Status" />
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
                </View>

                {/* Section: Photos */}
                <Text style={styles.sectionTitle}>Photos</Text>
                <View style={styles.section}>
                    {(form.photos ?? []).map((url) => (
                        <View key={url} style={styles.photoRow}>
                            <Image source={{ uri: url }} style={styles.photoThumb} />
                            <Text style={styles.photoUrl} numberOfLines={1}>{url}</Text>
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

                {/* Create button */}
                <Pressable
                    style={[styles.createBtn, !isValid && styles.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!isValid || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.createBtnText}>Create Place</Text>
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
    row: { flexDirection: 'row', gap: spacing.md },
    halfField: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    chipActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    chipText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.bodySemiBold },
    chipTextActive: { color: '#fff' },
    tagChip: {
        backgroundColor: colors.electricBlueLight, paddingHorizontal: 12,
        paddingVertical: 5, borderRadius: 14,
    },
    tagChipText: { fontSize: 13, color: colors.electricBlue, fontFamily: fonts.bodySemiBold },
    addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    addBtn: {
        backgroundColor: colors.electricBlue, width: 44, height: 44,
        borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center',
    },
    addBtnText: { color: '#fff', fontSize: 22, fontFamily: fonts.bodyBold },
    photoRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm,
        backgroundColor: colors.bgMain, borderRadius: borderRadius.sm, padding: spacing.sm,
    },
    photoThumb: {
        width: 48, height: 48, borderRadius: borderRadius.sm, backgroundColor: colors.borderColor,
    },
    photoUrl: { flex: 1, fontSize: 12, fontFamily: fonts.body, color: colors.textSecondary },
    removeBtn: { fontSize: 22, color: colors.error, fontFamily: fonts.bodyBold, paddingHorizontal: spacing.sm },
    createBtn: {
        backgroundColor: colors.successEmerald, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl,
    },
    createBtnDisabled: { opacity: 0.4 },
    createBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.bodyBold },
});
