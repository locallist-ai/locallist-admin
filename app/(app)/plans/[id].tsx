import React from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PlaceSearch from '../../../src/components/PlaceSearch';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';
import { usePlanForm } from '../../../src/hooks/usePlanForm';

const PLAN_TYPES = ['foodie', 'culture', 'adventure', 'nightlife', 'wellness', 'family', 'custom'] as const;
const DURATION_OPTIONS = [1, 2, 3, 4, 5] as const;
const TIME_BLOCKS = ['morning', 'lunch', 'afternoon', 'dinner', 'late_night'] as const;

export default function PlanEditScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams<{ id: string }>();
    const {
        plan,
        loading,
        saving,
        form,
        setField,
        translating,
        stops,
        addDay,
        setAddDay,
        addTimeBlock,
        setAddTimeBlock,
        addDuration,
        setAddDuration,
        hasChanges,
        handleSave,
        handleDelete,
        handleSuggestTranslation,
        handleAddStop,
        removeStop,
        moveStop,
    } = usePlanForm(id);

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
                <Text style={{ color: colors.error, fontFamily: fonts.body }}>{t('planEdit.notFound')}</Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: form.name || t('nav.editPlan'),
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Metadata */}
                <Text style={styles.sectionTitle}>{t('plan.details')}</Text>
                <View style={styles.section}>
                    <FieldLabel label={t('plan.name')} />
                    <TextInput
                        style={styles.input}
                        value={form.name}
                        onChangeText={(v) => setField('name', v)}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('plan.city')} />
                    <TextInput
                        style={styles.input}
                        value={form.city}
                        onChangeText={(v) => setField('city', v)}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('plan.type')} />
                    <View style={styles.chipRow}>
                        {PLAN_TYPES.map((planType) => (
                            <Pressable
                                key={planType}
                                style={[styles.chip, form.type === planType && styles.chipActive]}
                                onPress={() => setField('type', planType)}
                            >
                                <Text style={[styles.chipText, form.type === planType && styles.chipTextActive]}>{planType}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label={t('plan.duration')} />
                    <View style={styles.chipRow}>
                        {DURATION_OPTIONS.map((d) => (
                            <Pressable
                                key={d}
                                style={[styles.chip, form.durationDays === d && styles.chipActive]}
                                onPress={() => setField('durationDays', d)}
                            >
                                <Text style={[styles.chipText, form.durationDays === d && styles.chipTextActive]}>{d}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label={t('plan.description')} />
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={form.description}
                        onChangeText={(v) => setField('description', v)}
                        multiline numberOfLines={3} textAlignVertical="top"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('plan.coverImageUrl')} />
                    <TextInput
                        style={styles.input}
                        value={form.imageUrl}
                        onChangeText={(v) => setField('imageUrl', v)}
                        autoCapitalize="none"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <Text style={styles.sectionTitle}>{t('plan.visibility')}</Text>
                <View style={styles.section}>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>{t('plansList.public')}</Text>
                        <Switch
                            value={form.isPublic}
                            onValueChange={(v) => setField('isPublic', v)}
                            trackColor={{ false: colors.borderColor, true: colors.electricBlue }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>{t('plansList.showcase')}</Text>
                        <Switch
                            value={form.isShowcase}
                            onValueChange={(v) => setField('isShowcase', v)}
                            trackColor={{ false: colors.borderColor, true: colors.sunsetOrange }}
                        />
                    </View>
                </View>

                {/* Translations (ES) — curated plans only */}
                {plan?.source === 'curated' && (
                    <>
                        <Text style={styles.sectionTitle}>{t('placeEdit.sectionTranslation')}</Text>
                        <View style={styles.section}>
                            <Pressable
                                style={[styles.translateBtn, translating && { opacity: 0.5 }]}
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
                                    onValueChange={(v) => setField('translationStatusEs', v ? 'approved' : 'draft')}
                                    trackColor={{ false: colors.borderColor, true: colors.successEmerald }}
                                />
                            </View>

                            <FieldLabel label={t('placeEdit.nameEs')} />
                            <TextInput
                                style={styles.input}
                                value={form.nameEs ?? ''}
                                onChangeText={(v) => setField('nameEs', v || null)}
                                placeholder={form.name}
                                placeholderTextColor={colors.textSecondary}
                            />

                            <FieldLabel label={t('planEdit.descriptionEs')} />
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                value={form.descriptionEs ?? ''}
                                onChangeText={(v) => setField('descriptionEs', v || null)}
                                placeholder={form.description || ''}
                                placeholderTextColor={colors.textSecondary}
                                multiline numberOfLines={3} textAlignVertical="top"
                            />
                        </View>
                    </>
                )}

                {/* Stops by day */}
                <Text style={styles.sectionTitle}>{t('planEdit.stops')}</Text>
                {Array.from({ length: form.durationDays }, (_, i) => i + 1).map(day => {
                    const dayStops = stops
                        .filter(s => s.dayNumber === day)
                        .sort((a, b) => a.orderIndex - b.orderIndex);

                    return (
                        <View key={day} style={styles.daySection}>
                            <Text style={styles.dayTitle}>{t('planEdit.day', { day: String(day) })}</Text>
                            {dayStops.length === 0 ? (
                                <Text style={styles.emptyDay}>{t('planEdit.noStops')}</Text>
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
                <Text style={styles.sectionTitle}>{t('planEdit.addStop')}</Text>
                <View style={styles.section}>
                    <FieldLabel label={t('planEdit.searchPlace')} />
                    <PlaceSearch onSelect={handleAddStop} />

                    <FieldLabel label={t('planEdit.dayLabel')} />
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

                    <FieldLabel label={t('planEdit.timeBlock')} />
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

                    <FieldLabel label={t('planEdit.durationMin')} />
                    <TextInput
                        style={styles.input}
                        value={addDuration}
                        onChangeText={setAddDuration}
                        placeholder={t('planEdit.durationMinPlaceholder')}
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
                            {hasChanges ? t('common.saveChanges') : t('common.noChanges')}
                        </Text>
                    )}
                </Pressable>

                {/* Delete */}
                <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>{t('planEdit.deletePlan')}</Text>
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
    translateBtn: {
        backgroundColor: colors.electricBlue, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md,
    },
    translateBtnText: { color: '#fff', fontSize: 15, fontFamily: fonts.bodySemiBold },
});
