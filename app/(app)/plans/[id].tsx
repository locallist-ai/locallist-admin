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
    Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../../src/lib/api';
import type { PlanData, PlanStopData } from '../../../src/types/plan';
import type { PlaceData } from '../../../src/types/place';
import PlaceSearch from '../../../src/components/PlaceSearch';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';

const PLAN_TYPES = ['foodie', 'culture', 'adventure', 'nightlife', 'wellness', 'family', 'custom'] as const;
const DURATION_OPTIONS = [1, 2, 3, 4, 5] as const;
const TIME_BLOCKS = ['morning', 'lunch', 'afternoon', 'dinner', 'late_night'] as const;

interface LocalStop {
    placeId: string;
    placeName: string;
    placeCategory: string;
    dayNumber: number;
    orderIndex: number;
    timeBlock?: string;
    suggestedDurationMin?: number;
}

export default function PlanEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [plan, setPlan] = useState<PlanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Metadata form
    const [form, setForm] = useState({
        name: '', city: '', type: 'custom', description: '', imageUrl: '',
        durationDays: 1, isPublic: true, isShowcase: false,
    });
    const originalFormRef = useRef(form);

    // Stops
    const [stops, setStops] = useState<LocalStop[]>([]);
    const originalStopsRef = useRef<string>('[]');

    // Add stop form
    const [addDay, setAddDay] = useState(1);
    const [addTimeBlock, setAddTimeBlock] = useState<string | undefined>();
    const [addDuration, setAddDuration] = useState('');

    const loadPlan = useCallback(async () => {
        setLoading(true);
        const res = await api<PlanData>(`/admin/plans/${id}`);
        if (res.data) {
            setPlan(res.data);
            const f = {
                name: res.data.name,
                city: res.data.city,
                type: res.data.type,
                description: res.data.description ?? '',
                imageUrl: res.data.imageUrl ?? '',
                durationDays: res.data.durationDays,
                isPublic: res.data.isPublic,
                isShowcase: res.data.isShowcase,
            };
            setForm(f);
            originalFormRef.current = f;

            const loadedStops: LocalStop[] = (res.data.days ?? []).flatMap(day =>
                day.stops.map(s => ({
                    placeId: s.place.id,
                    placeName: s.place.name,
                    placeCategory: s.place.category,
                    dayNumber: day.dayNumber,
                    orderIndex: s.orderIndex,
                    timeBlock: s.timeBlock,
                    suggestedDurationMin: s.suggestedDurationMin,
                }))
            );
            setStops(loadedStops);
            originalStopsRef.current = JSON.stringify(loadedStops);
        } else {
            Alert.alert('Error', `Failed to load plan: ${res.error}`);
        }
        setLoading(false);
    }, [id]);

    useEffect(() => { loadPlan(); }, [loadPlan]);

    const getMetadataDirty = () => {
        const orig = originalFormRef.current;
        const dirty: Record<string, unknown> = {};
        for (const key of Object.keys(form) as (keyof typeof form)[]) {
            if (form[key] !== orig[key]) dirty[key] = form[key];
        }
        return dirty;
    };

    const stopsChanged = () => JSON.stringify(stops) !== originalStopsRef.current;

    const handleSave = async () => {
        const metaDirty = getMetadataDirty();
        const hasMetaChanges = Object.keys(metaDirty).length > 0;
        const hasStopChanges = stopsChanged();

        if (!hasMetaChanges && !hasStopChanges) {
            Alert.alert('No changes', 'Nothing to save.');
            return;
        }

        setSaving(true);

        if (hasMetaChanges) {
            const res = await api(`/admin/plans/${id}`, {
                method: 'PATCH',
                body: metaDirty,
            });
            if (res.error) {
                setSaving(false);
                Alert.alert('Error', `Failed to update plan: ${res.error}`);
                return;
            }
        }

        if (hasStopChanges) {
            const stopsPayload = stops.map(s => ({
                placeId: s.placeId,
                dayNumber: s.dayNumber,
                orderIndex: s.orderIndex,
                timeBlock: s.timeBlock,
                suggestedDurationMin: s.suggestedDurationMin,
            }));

            const res = await api(`/admin/plans/${id}/stops`, {
                method: 'PUT',
                body: { stops: stopsPayload },
            });
            if (res.error) {
                setSaving(false);
                Alert.alert('Error', `Failed to update stops: ${res.error}`);
                return;
            }
        }

        setSaving(false);
        Alert.alert('Saved', 'Plan updated successfully.');
        // Refresh to sync with server
        await loadPlan();
    };

    const handleDelete = () => {
        Alert.alert('Delete Plan', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const res = await api(`/admin/plans/${id}`, { method: 'DELETE' });
                    if (res.error) {
                        Alert.alert('Error', `Failed to delete: ${res.error}`);
                    } else {
                        router.back();
                    }
                },
            },
        ]);
    };

    const handleAddStop = (place: PlaceData) => {
        const dayStops = stops.filter(s => s.dayNumber === addDay);
        const newStop: LocalStop = {
            placeId: place.id,
            placeName: place.name,
            placeCategory: place.category,
            dayNumber: addDay,
            orderIndex: dayStops.length,
            timeBlock: addTimeBlock,
            suggestedDurationMin: addDuration ? parseInt(addDuration, 10) : undefined,
        };
        setStops(prev => [...prev, newStop]);
        setAddDuration('');
        setAddTimeBlock(undefined);
    };

    const removeStop = (dayNumber: number, orderIndex: number) => {
        setStops(prev => {
            const filtered = prev.filter(s => !(s.dayNumber === dayNumber && s.orderIndex === orderIndex));
            // Re-index stops for this day
            let idx = 0;
            return filtered.map(s => {
                if (s.dayNumber === dayNumber) {
                    return { ...s, orderIndex: idx++ };
                }
                return s;
            });
        });
    };

    const moveStop = (dayNumber: number, orderIndex: number, direction: -1 | 1) => {
        setStops(prev => {
            const dayStops = prev.filter(s => s.dayNumber === dayNumber).sort((a, b) => a.orderIndex - b.orderIndex);
            const idx = dayStops.findIndex(s => s.orderIndex === orderIndex);
            const targetIdx = idx + direction;
            if (targetIdx < 0 || targetIdx >= dayStops.length) return prev;

            // Swap order indices
            const swapped = [...dayStops];
            [swapped[idx], swapped[targetIdx]] = [swapped[targetIdx], swapped[idx]];
            const reindexed = swapped.map((s, i) => ({ ...s, orderIndex: i }));

            const otherStops = prev.filter(s => s.dayNumber !== dayNumber);
            return [...otherStops, ...reindexed];
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.electricBlue} size="large" />
            </View>
        );
    }

    if (!plan) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: colors.error, fontFamily: fonts.body }}>Plan not found</Text>
            </View>
        );
    }

    const hasChanges = Object.keys(getMetadataDirty()).length > 0 || stopsChanged();

    return (
        <>
            <Stack.Screen
                options={{
                    title: form.name || 'Edit Plan',
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Metadata */}
                <Text style={styles.sectionTitle}>Plan Details</Text>
                <View style={styles.section}>
                    <FieldLabel label="Name" />
                    <TextInput
                        style={styles.input}
                        value={form.name}
                        onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="City" />
                    <TextInput
                        style={styles.input}
                        value={form.city}
                        onChangeText={(v) => setForm(f => ({ ...f, city: v }))}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="Type" />
                    <View style={styles.chipRow}>
                        {PLAN_TYPES.map((t) => (
                            <Pressable
                                key={t}
                                style={[styles.chip, form.type === t && styles.chipActive]}
                                onPress={() => setForm(f => ({ ...f, type: t }))}
                            >
                                <Text style={[styles.chipText, form.type === t && styles.chipTextActive]}>{t}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label="Duration (days)" />
                    <View style={styles.chipRow}>
                        {DURATION_OPTIONS.map((d) => (
                            <Pressable
                                key={d}
                                style={[styles.chip, form.durationDays === d && styles.chipActive]}
                                onPress={() => setForm(f => ({ ...f, durationDays: d }))}
                            >
                                <Text style={[styles.chipText, form.durationDays === d && styles.chipTextActive]}>{d}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label="Description" />
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={form.description}
                        onChangeText={(v) => setForm(f => ({ ...f, description: v }))}
                        multiline numberOfLines={3} textAlignVertical="top"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label="Cover Image URL" />
                    <TextInput
                        style={styles.input}
                        value={form.imageUrl}
                        onChangeText={(v) => setForm(f => ({ ...f, imageUrl: v }))}
                        autoCapitalize="none"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <Text style={styles.sectionTitle}>Visibility</Text>
                <View style={styles.section}>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Public</Text>
                        <Switch
                            value={form.isPublic}
                            onValueChange={(v) => setForm(f => ({ ...f, isPublic: v }))}
                            trackColor={{ false: colors.borderColor, true: colors.electricBlue }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Showcase</Text>
                        <Switch
                            value={form.isShowcase}
                            onValueChange={(v) => setForm(f => ({ ...f, isShowcase: v }))}
                            trackColor={{ false: colors.borderColor, true: colors.sunsetOrange }}
                        />
                    </View>
                </View>

                {/* Stops by day */}
                <Text style={styles.sectionTitle}>Stops</Text>
                {Array.from({ length: form.durationDays }, (_, i) => i + 1).map(day => {
                    const dayStops = stops
                        .filter(s => s.dayNumber === day)
                        .sort((a, b) => a.orderIndex - b.orderIndex);

                    return (
                        <View key={day} style={styles.daySection}>
                            <Text style={styles.dayTitle}>Day {day}</Text>
                            {dayStops.length === 0 ? (
                                <Text style={styles.emptyDay}>No stops yet</Text>
                            ) : (
                                dayStops.map((stop) => (
                                    <View key={`${stop.placeId}-${stop.orderIndex}`} style={styles.stopItem}>
                                        <View style={styles.stopInfo}>
                                            <Text style={styles.stopName}>{stop.orderIndex + 1}. {stop.placeName}</Text>
                                            <Text style={styles.stopMeta}>
                                                {stop.placeCategory}
                                                {stop.timeBlock ? ` · ${stop.timeBlock}` : ''}
                                                {stop.suggestedDurationMin ? ` · ${stop.suggestedDurationMin}min` : ''}
                                            </Text>
                                        </View>
                                        <View style={styles.stopActions}>
                                            <Pressable onPress={() => moveStop(day, stop.orderIndex, -1)} hitSlop={4}>
                                                <Text style={styles.moveBtn}>▲</Text>
                                            </Pressable>
                                            <Pressable onPress={() => moveStop(day, stop.orderIndex, 1)} hitSlop={4}>
                                                <Text style={styles.moveBtn}>▼</Text>
                                            </Pressable>
                                            <Pressable onPress={() => removeStop(day, stop.orderIndex)} hitSlop={4}>
                                                <Text style={styles.removeBtnText}>×</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    );
                })}

                {/* Add stop */}
                <Text style={styles.sectionTitle}>Add Stop</Text>
                <View style={styles.section}>
                    <FieldLabel label="Search Place" />
                    <PlaceSearch onSelect={handleAddStop} />

                    <FieldLabel label="Day" />
                    <View style={styles.chipRow}>
                        {Array.from({ length: form.durationDays }, (_, i) => i + 1).map(d => (
                            <Pressable
                                key={d}
                                style={[styles.chip, addDay === d && styles.chipActive]}
                                onPress={() => setAddDay(d)}
                            >
                                <Text style={[styles.chipText, addDay === d && styles.chipTextActive]}>{d}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label="Time Block" />
                    <View style={styles.chipRow}>
                        {TIME_BLOCKS.map(tb => (
                            <Pressable
                                key={tb}
                                style={[styles.chip, addTimeBlock === tb && styles.chipActive]}
                                onPress={() => setAddTimeBlock(addTimeBlock === tb ? undefined : tb)}
                            >
                                <Text style={[styles.chipText, addTimeBlock === tb && styles.chipTextActive]}>{tb}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label="Duration (min)" />
                    <TextInput
                        style={styles.input}
                        value={addDuration}
                        onChangeText={setAddDuration}
                        placeholder="e.g. 45"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                {/* Save */}
                <Pressable
                    style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!hasChanges || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.saveBtnText}>
                            {hasChanges ? 'Save Changes' : 'No Changes'}
                        </Text>
                    )}
                </Pressable>

                {/* Delete */}
                <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>Delete Plan</Text>
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
    loadingContainer: { flex: 1, backgroundColor: colors.bgMain, justifyContent: 'center', alignItems: 'center' },
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
    toggleRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    toggleLabel: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain },

    // Day sections
    daySection: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.borderColor,
        marginBottom: spacing.sm,
    },
    dayTitle: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.deepOcean, marginBottom: spacing.sm },
    emptyDay: { fontSize: 14, fontFamily: fonts.body, color: colors.textSecondary, fontStyle: 'italic' },
    stopItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderColor,
    },
    stopInfo: { flex: 1 },
    stopName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain },
    stopMeta: { fontSize: 13, fontFamily: fonts.body, color: colors.textSecondary, marginTop: 2 },
    stopActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    moveBtn: { fontSize: 16, color: colors.textSecondary, paddingHorizontal: 4 },
    removeBtnText: { fontSize: 22, color: colors.error, fontFamily: fonts.bodyBold, paddingHorizontal: 4 },

    // Save / Delete
    saveBtn: {
        backgroundColor: colors.successEmerald, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.bodyBold },
    deleteBtn: {
        borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center',
        marginTop: spacing.md, borderWidth: 1, borderColor: colors.error,
    },
    deleteBtnText: { color: colors.error, fontSize: 16, fontFamily: fonts.bodySemiBold },
});
