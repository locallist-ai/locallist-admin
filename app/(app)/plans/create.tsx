import React, { useState } from 'react';
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
import { showAlert } from '../../../src/lib/dialogs';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/lib/api';
import type { PlanData } from '../../../src/types/plan';
import { colors, fonts, spacing, borderRadius } from '../../../src/lib/theme';

const PLAN_TYPES = ['foodie', 'culture', 'adventure', 'nightlife', 'wellness', 'family', 'custom'] as const;
const DURATION_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function PlanCreateScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [city, setCity] = useState('Miami');
    const [type, setType] = useState('custom');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [durationDays, setDurationDays] = useState(1);
    const [isPublic, setIsPublic] = useState(true);
    const [isShowcase, setIsShowcase] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            showAlert(t('common.required'), t('planCreate.nameRequired'));
            return;
        }

        setSaving(true);
        const res = await api<PlanData>('/admin/plans', {
            method: 'POST',
            body: {
                name: name.trim(),
                city: city.trim() || 'Miami',
                type,
                description: description.trim() || undefined,
                imageUrl: imageUrl.trim() || undefined,
                durationDays,
                isPublic,
                isShowcase,
                stops: [],
            },
        });
        setSaving(false);

        if (res.data) {
            showAlert(t('placeCreate.createdTitle'), t('planCreate.createdMsg', { name: res.data.name }));
            router.replace(`/plans/${res.data.id}`);
        } else {
            showAlert(t('common.error'), t('placeCreate.createFailed', { error: res.error ?? '' }));
        }
    };

    const isValid = !!name.trim();

    return (
        <>
            <Stack.Screen
                options={{
                    title: t('nav.createPlan'),
                    headerStyle: { backgroundColor: colors.bgMain },
                    headerTintColor: colors.deepOcean,
                }}
            />
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>{t('plan.details')}</Text>
                <View style={styles.section}>
                    <FieldLabel label={t('planCreate.nameLabel')} />
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder={t('planCreate.namePlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('plan.city')} />
                    <TextInput
                        style={styles.input}
                        value={city}
                        onChangeText={setCity}
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('plan.type')} />
                    <View style={styles.chipRow}>
                        {PLAN_TYPES.map((planType) => (
                            <Pressable
                                key={planType}
                                style={[styles.chip, type === planType && styles.chipActive]}
                                onPress={() => setType(planType)}
                            >
                                <Text style={[styles.chipText, type === planType && styles.chipTextActive]}>
                                    {planType}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label={t('plan.duration')} />
                    <View style={styles.chipRow}>
                        {DURATION_OPTIONS.map((d) => (
                            <Pressable
                                key={d}
                                style={[styles.chip, durationDays === d && styles.chipActive]}
                                onPress={() => setDurationDays(d)}
                            >
                                <Text style={[styles.chipText, durationDays === d && styles.chipTextActive]}>
                                    {d}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <FieldLabel label={t('plan.description')} />
                    <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder={t('planCreate.descriptionPlaceholder')}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel label={t('plan.coverImageUrl')} />
                    <TextInput
                        style={styles.input}
                        value={imageUrl}
                        onChangeText={setImageUrl}
                        placeholder={t('planCreate.imageUrlPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                    />
                </View>

                <Text style={styles.sectionTitle}>{t('plan.visibility')}</Text>
                <View style={styles.section}>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>{t('plansList.public')}</Text>
                        <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: colors.borderColor, true: colors.electricBlue }}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>{t('plansList.showcase')}</Text>
                        <Switch
                            value={isShowcase}
                            onValueChange={setIsShowcase}
                            trackColor={{ false: colors.borderColor, true: colors.sunsetOrange }}
                        />
                    </View>
                </View>

                <Pressable
                    style={[styles.createBtn, !isValid && styles.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!isValid || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.createBtnText}>{t('nav.createPlan')}</Text>
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
    toggleRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    toggleLabel: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain },
    createBtn: {
        backgroundColor: colors.successEmerald, borderRadius: borderRadius.md,
        paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl,
    },
    createBtnDisabled: { opacity: 0.4 },
    createBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.bodyBold },
});
