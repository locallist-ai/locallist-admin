import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ActionSheetIOS,
    Platform,
    ScrollView,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import OptionsMenuModal from '../../src/components/OptionsMenuModal';
import { showAlert } from '../../src/lib/dialogs';
import { runBatchTranslate, type BatchChunk } from '../../src/lib/batchTranslate';
import { refreshTasksFor, type Mode, type StatusTab } from '../../src/lib/dashboardQueries';
import type { PlaceData } from '../../src/types/place';
import { colors, fonts, spacing } from '../../src/lib/theme';
import { CATEGORIES } from '../../src/lib/constants';

export default function DashboardScreen() {
    const { t } = useTranslation();
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
    const [createMenuVisible, setCreateMenuVisible] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ label: string; current: number; total: number } | null>(null);
    const batchCancelRef = useRef<AbortController | null>(null);
    // Synchronous in-flight guard: flips true BEFORE the first await so a second
    // trigger on the same tick (double-click, or the other mode's button) is a
    // no-op even before React re-renders and disables the buttons.
    const batchRunningRef = useRef(false);
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
        // (1) In-flight guard, checked before any await: a concurrent trigger
        // returns here and never spawns a second loop.
        if (batchRunningRef.current) return;
        batchRunningRef.current = true;

        // (2) Disable the buttons on THIS tick. translateDisabled/disabled read
        // !!batchProgress, so setting it synchronously (before the first
        // round-trip) closes the window a second trigger used to slip through.
        // total:0 renders an indeterminate "starting…"; runBatchTranslate fixes
        // the real total on the first chunk via onProgress.
        setBatchProgress({ label, current: 0, total: 0 });

        // (3) Defense-in-depth: abort any stray prior controller before taking
        // over the ref (harmless if null). The guard above makes this
        // unreachable, but it is cheap insurance against a leaked loop.
        batchCancelRef.current?.abort();
        const controller = new AbortController();
        batchCancelRef.current = controller;

        try {
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

            if (result.error) {
                showAlert(t('common.error'), t('dashboard.batchFailed', { error: result.error ?? '' }));
            } else if (!result.aborted) {
                showAlert(t('common.done'), t('dashboard.batchDone', { translated: String(result.translated), failed: String(result.failed) }));
            }
        } finally {
            // Clears on success, error AND abort so the buttons re-enable and a
            // new run can start.
            setBatchProgress(null);
            batchCancelRef.current = null;
            batchRunningRef.current = false;
        }
    };

    const handleTranslatePlacesBatch = () => {
        showAlert(
            t('dashboard.translatePlacesTitle'),
            t('dashboard.translatePlacesMsg'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('dashboard.translate'), onPress: () => runBatchTranslateLoop('/admin/places/translate-batch', t('dashboard.translatingPlaces')) },
            ]
        );
    };

    const handleTranslatePlansBatch = () => {
        showAlert(
            t('dashboard.translatePlansTitle'),
            t('dashboard.translatePlansMsg'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('dashboard.translate'), onPress: () => runBatchTranslateLoop('/admin/plans/translate-batch', t('dashboard.translatingPlans')) },
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
                    options: [t('common.cancel'), t('dashboard.createManually'), t('dashboard.importGoogle'), t('dashboard.importBatch'), t('dashboard.backfillDescriptions')],
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
            // Alert.alert con botones es no-op en react-native-web: menú propio.
            setCreateMenuVisible(true);
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
                    onAnalyticsPress={() => router.push('/analytics')}
                    onBillingPress={() => router.push('/billing')}
                />

                {/* Segment control */}
                <View style={[styles.segmentRow, isDesktop && styles.segmentRowDesktop]}>
                    <Pressable
                        style={[styles.segment, mode === 'places' && styles.segmentActive]}
                        onPress={() => setMode('places')}
                    >
                        <Text style={[styles.segmentText, mode === 'places' && styles.segmentTextActive]}>
                            {t('dashboard.places')}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segment, mode === 'plans' && styles.segmentActive]}
                        onPress={() => setMode('plans')}
                    >
                        <Text style={[styles.segmentText, mode === 'plans' && styles.segmentTextActive]}>
                            {t('dashboard.plans')}
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
                                    allLabel={t('placesList.all')}
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
                            <Text style={batchBtnStyles.batchTranslateBtnText}>{t('dashboard.translateAllCurated')}</Text>
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

            <OptionsMenuModal
                visible={createMenuVisible}
                title={t('dashboard.addPlace')}
                options={[
                    { label: t('dashboard.createManually'), onSelect: () => router.push('/place/create') },
                    { label: t('dashboard.importGoogle'), onSelect: () => router.push('/places/import-google') },
                    { label: t('dashboard.importBatch'), onSelect: () => router.push('/places/import-batch') },
                    { label: t('dashboard.backfillDescriptions'), onSelect: () => router.push('/places/backfill-descriptions') },
                ]}
                onClose={() => setCreateMenuVisible(false)}
            />

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
                            {batchProgress
                                ? (batchProgress.total > 0
                                    ? `${batchProgress.current} / ${batchProgress.total}`
                                    : t('dashboard.batchStarting'))
                                : ''}
                        </Text>
                        <Pressable
                            onPress={() => { batchCancelRef.current?.abort(); setBatchProgress(null); }}
                            style={styles.batchOverlayCancel}
                        >
                            <Text style={styles.batchOverlayCancelText}>{t('common.cancel')}</Text>
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
