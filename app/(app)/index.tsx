import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ActionSheetIOS,
    Alert,
    Platform,
    ScrollView,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import { useFilterState } from '../../src/hooks/useFilterState';
import { usePlacesData } from '../../src/hooks/usePlacesData';
import { usePlansData } from '../../src/hooks/usePlansData';
import DashboardHeader from '../../src/components/DashboardHeader';
import FilterBar, { FilterChipRow } from '../../src/components/FilterBar';
import StatusTabs from '../../src/components/StatusTabs';
import BatchActionsRow, { batchBtnStyles } from '../../src/components/BatchActionsRow';
import PlacesList from '../../src/components/PlacesList';
import PlansList from '../../src/components/PlansList';
import RejectionModal from '../../src/components/RejectionModal';
import { runBatchTranslate, type BatchChunk } from '../../src/lib/batchTranslate';
import { refreshTasksFor, type Mode, type StatusTab } from '../../src/lib/dashboardQueries';
import type { PlaceData } from '../../src/types/place';
import { colors, fonts, spacing } from '../../src/lib/theme';
import { CATEGORIES } from '../../src/lib/constants';

export default function DashboardScreen() {
    const { isDesktop } = useBreakpoint();
    const router = useRouter();

    const [mode, setMode] = useState<Mode>('places');
    const filters = useFilterState();
    const placesData = usePlacesData({
        mode,
        city: filters.selectedCity,
        category: filters.selectedCategory,
        search: filters.debouncedSearch,
    });
    const plansData = usePlansData({ mode });

    const [rejectionTarget, setRejectionTarget] = useState<PlaceData | null>(null);
    const [batchProgress, setBatchProgress] = useState<{ label: string; current: number; total: number } | null>(null);
    const batchCancelRef = useRef<AbortController | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const handleTabSelect = (tab: StatusTab) => {
        placesData.setActiveTab(tab);
        // The category filter only exists on Published; leaving it set
        // would silently filter the next visit to that tab.
        if (tab !== 'published') filters.setSelectedCategory(null);
    };

    const handleRejectStart = (placeId: string) => {
        const place = placesData.places.find((p) => p.id === placeId);
        if (place) setRejectionTarget(place);
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectionTarget) return;
        const placeId = rejectionTarget.id;
        setRejectionTarget(null);
        await placesData.rejectPlace(placeId, reason);
    };

    const runBatchTranslateLoop = async (
        endpoint: '/admin/places/translate-batch' | '/admin/plans/translate-batch',
        label: string,
    ) => {
        const controller = new AbortController();
        batchCancelRef.current = controller;

        const result = await runBatchTranslate(
            async () => {
                const res = await api<BatchChunk>(`${endpoint}?limit=10`, {
                    method: 'POST', timeoutMs: 60_000, signal: controller.signal,
                });
                return { data: res.data, error: res.error ?? null };
            },
            controller.signal,
            ({ current, total }) => setBatchProgress({ label, current, total }),
        );

        setBatchProgress(null);
        batchCancelRef.current = null;

        if (result.error) {
            Alert.alert('Error', `Batch translate failed: ${result.error}`);
        } else if (!result.aborted) {
            Alert.alert('Done', `Translated: ${result.translated}, Failed: ${result.failed}`);
        }
    };

    const handleTranslatePlacesBatch = () => {
        Alert.alert(
            'Translate All Curated Places (ES)',
            'This will send all untranslated curated places to Gemini for ES draft translation. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Translate', onPress: () => runBatchTranslateLoop('/admin/places/translate-batch', 'Translating places…') },
            ]
        );
    };

    const handleTranslatePlansBatch = () => {
        Alert.alert(
            'Translate All Curated Plans (ES)',
            'This will send all untranslated curated plans to Gemini for ES draft translation. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Translate', onPress: () => runBatchTranslateLoop('/admin/plans/translate-batch', 'Translating plans…') },
            ]
        );
    };

    const handleCreatePress = () => {
        if (mode === 'plans') {
            router.push('/plans/create');
            return;
        }
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Create manually', 'Import from Google', 'Import batch (links/CSV)', 'Backfill descriptions'],
                    cancelButtonIndex: 0,
                },
                (idx) => {
                    if (idx === 1) router.push('/place/create');
                    else if (idx === 2) router.push('/places/import-google');
                    else if (idx === 3) router.push('/places/import-batch');
                    else if (idx === 4) router.push('/places/backfill-descriptions');
                }
            );
        } else {
            Alert.alert('Add place', '', [
                { text: 'Create manually', onPress: () => router.push('/place/create') },
                { text: 'Import from Google', onPress: () => router.push('/places/import-google') },
                { text: 'Import batch (links/CSV)', onPress: () => router.push('/places/import-batch') },
                { text: 'Backfill descriptions', onPress: () => router.push('/places/backfill-descriptions') },
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all(refreshTasksFor(mode).map((task) => {
            switch (task) {
                case 'cities': return filters.loadCities();
                case 'counts': return placesData.loadCounts();
                case 'places': return placesData.loadPlaces(placesData.activeTab);
                case 'plans': return plansData.loadPlans();
                default: return Promise.resolve();
            }
        }));
        setRefreshing(false);
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <DashboardHeader
                    refreshing={refreshing}
                    isDesktop={isDesktop}
                    onRefresh={handleRefresh}
                    onCreatePress={handleCreatePress}
                />

                {/* Segment control */}
                <View style={[styles.segmentRow, isDesktop && styles.segmentRowDesktop]}>
                    <Pressable
                        style={[styles.segment, mode === 'places' && styles.segmentActive]}
                        onPress={() => setMode('places')}
                    >
                        <Text style={[styles.segmentText, mode === 'places' && styles.segmentTextActive]}>
                            Places
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segment, mode === 'plans' && styles.segmentActive]}
                        onPress={() => setMode('plans')}
                    >
                        <Text style={[styles.segmentText, mode === 'plans' && styles.segmentTextActive]}>
                            Plans
                        </Text>
                    </Pressable>
                </View>

                {mode === 'places' ? (
                    <>
                        <FilterBar
                            searchQuery={filters.searchQuery}
                            onSearchChange={filters.setSearchQuery}
                            cities={filters.cities}
                            selectedCity={filters.selectedCity}
                            onCityChange={filters.setSelectedCity}
                            isDesktop={isDesktop}
                        />

                        <StatusTabs
                            activeTab={placesData.activeTab}
                            counts={placesData.counts}
                            isDesktop={isDesktop}
                            onSelect={handleTabSelect}
                        />

                        {placesData.activeTab === 'published' && (
                            <>
                                <FilterChipRow
                                    options={CATEGORIES}
                                    selected={filters.selectedCategory}
                                    allLabel="All"
                                    isDesktop={isDesktop}
                                    onSelect={(cat) => filters.setSelectedCategory(
                                        cat === filters.selectedCategory ? null : cat
                                    )}
                                />
                                <BatchActionsRow
                                    translateDisabled={!!batchProgress}
                                    onTranslate={handleTranslatePlacesBatch}
                                />
                            </>
                        )}

                        <PlacesList
                            activeTab={placesData.activeTab}
                            places={placesData.places}
                            total={placesData.total}
                            loading={placesData.loading}
                            loadingMore={placesData.loadingMore}
                            actionLoading={placesData.actionLoading}
                            isDesktop={isDesktop}
                            onLoadMore={placesData.loadMore}
                            onReloadQueue={() => placesData.loadPlaces('in_review')}
                            onApprove={placesData.approvePlace}
                            onRejectStart={handleRejectStart}
                            onPostpone={placesData.postponePlace}
                            onStatusChange={placesData.changePlaceStatus}
                            onDelete={placesData.deletePlace}
                        />
                    </>
                ) : (
                    <>
                        <Pressable
                            style={[batchBtnStyles.batchTranslateBtn, !!batchProgress && { opacity: 0.5 }]}
                            onPress={handleTranslatePlansBatch}
                            disabled={!!batchProgress}
                        >
                            <Text style={batchBtnStyles.batchTranslateBtnText}>Translate All Curated → ES</Text>
                        </Pressable>
                        <PlansList
                            plans={plansData.plans}
                            total={plansData.total}
                            loading={plansData.loading}
                            loadingMore={plansData.loadingMore}
                            onLoadMore={plansData.loadMore}
                            onUnpublish={plansData.unpublishPlan}
                            onDelete={plansData.deletePlan}
                        />
                    </>
                )}
            </ScrollView>

            <RejectionModal
                visible={!!rejectionTarget}
                placeName={rejectionTarget?.name ?? ''}
                onConfirm={handleRejectConfirm}
                onCancel={() => setRejectionTarget(null)}
            />

            {/* Batch translate progress overlay */}
            <Modal visible={!!batchProgress} transparent animationType="fade">
                <View style={styles.batchOverlay}>
                    <View style={styles.batchOverlayCard}>
                        <ActivityIndicator color={colors.electricBlue} size="large" />
                        <Text style={styles.batchOverlayLabel}>{batchProgress?.label}</Text>
                        <Text style={styles.batchOverlayCount}>
                            {batchProgress ? `${batchProgress.current} / ${batchProgress.total}` : ''}
                        </Text>
                        <Pressable
                            onPress={() => { batchCancelRef.current?.abort(); setBatchProgress(null); }}
                            style={styles.batchOverlayCancel}
                        >
                            <Text style={styles.batchOverlayCancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgMain },
    scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },

    // Segment control
    segmentRow: {
        flexDirection: 'row', paddingHorizontal: 20, marginBottom: spacing.md,
    },
    segmentRowDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },
    segment: {
        flex: 1, paddingVertical: 10, alignItems: 'center',
        borderBottomWidth: 2, borderBottomColor: colors.borderColor,
    },
    segmentActive: { borderBottomColor: colors.electricBlue },
    segmentText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
    segmentTextActive: { color: colors.electricBlue },

    // Batch translate progress overlay
    batchOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
    },
    batchOverlayCard: {
        backgroundColor: colors.bgMain, borderRadius: 16, padding: 32,
        alignItems: 'center', gap: 16, minWidth: 240,
    },
    batchOverlayLabel: { color: colors.textMain, fontFamily: fonts.bodySemiBold, fontSize: 16 },
    batchOverlayCount: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14 },
    batchOverlayCancel: {
        marginTop: 8, paddingVertical: 8, paddingHorizontal: 24,
        borderRadius: 8, borderWidth: 1, borderColor: colors.error,
    },
    batchOverlayCancelText: { color: colors.error, fontFamily: fonts.bodySemiBold, fontSize: 14 },
});
