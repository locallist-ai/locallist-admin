import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import SwipeCard from '../../src/components/SwipeCard';
import RejectionModal from '../../src/components/RejectionModal';
import type { PlaceData, PlacesResponse } from '../../src/types/place';
import type { PlanData, PlansResponse } from '../../src/types/plan';
import { colors, fonts, spacing, borderRadius } from '../../src/lib/theme';

type Mode = 'places' | 'plans';
type StatusTab = 'in_review' | 'published' | 'rejected';

const TABS: { key: StatusTab; label: string }[] = [
    { key: 'in_review', label: 'Queue' },
    { key: 'published', label: 'Published' },
    { key: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE = 20;

export default function DashboardScreen() {
    const { signOut } = useAuth();
    const router = useRouter();
    const { isDesktop } = useBreakpoint();

    // Mode toggle
    const [mode, setMode] = useState<Mode>('places');

    // Places state
    const [activeTab, setActiveTab] = useState<StatusTab>('in_review');
    const [places, setPlaces] = useState<PlaceData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [counts, setCounts] = useState<Record<StatusTab, number>>({ in_review: 0, published: 0, rejected: 0 });
    const [rejectionTarget, setRejectionTarget] = useState<PlaceData | null>(null);
    const requestIdRef = useRef(0);

    // Plans state
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [plansTotal, setPlansTotal] = useState(0);
    const [plansLoading, setPlansLoading] = useState(false);
    const [plansLoadingMore, setPlansLoadingMore] = useState(false);

    // ─── Places logic ───

    const loadPlaces = useCallback(async (status: StatusTab, offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        const reqId = ++requestIdRef.current;

        const limit = status === 'in_review' ? 10 : PAGE_SIZE;
        const res = await api<PlacesResponse>(
            `/admin/places?status=${status}&limit=${limit}&offset=${offset}`
        );

        if (reqId !== requestIdRef.current) return;

        if (res.data) {
            if (isInitial) {
                setPlaces(res.data.places);
            } else {
                setPlaces((prev) => [...prev, ...res.data!.places]);
            }
            setTotal(res.data.total);
            setCounts((prev) => ({ ...prev, [status]: res.data!.total }));
        } else if (res.error) {
            Alert.alert('Error', `Failed to load places: ${res.error}`);
        }

        if (isInitial) setLoading(false);
        else setLoadingMore(false);
    }, []);

    useEffect(() => {
        Promise.all(
            TABS.map(async (tab) => {
                const res = await api<PlacesResponse>(`/admin/places?status=${tab.key}&limit=1`);
                if (res.data) {
                    setCounts((prev) => ({ ...prev, [tab.key]: res.data!.total }));
                }
            })
        );
    }, []);

    useEffect(() => {
        if (mode === 'places') loadPlaces(activeTab);
    }, [activeTab, loadPlaces, mode]);

    const handleLoadMore = () => {
        if (loadingMore || places.length >= total) return;
        loadPlaces(activeTab, places.length);
    };

    const handleApprove = async (placeId: string) => {
        const idx = places.findIndex((p) => p.id === placeId);
        const removed = idx >= 0 ? places[idx] : null;
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));

        setActionLoading(true);
        const res = await api(`/admin/places/${placeId}/review`, {
            method: 'PATCH',
            body: { status: 'published' },
        });
        setActionLoading(false);

        if (res.error) {
            if (removed) setPlaces((prev) => {
                const next = [...prev];
                next.splice(Math.min(idx, next.length), 0, removed);
                return next;
            });
            Alert.alert('Error', `Failed to approve: ${res.error}`);
        } else {
            setCounts((prev) => ({
                ...prev,
                in_review: Math.max(0, prev.in_review - 1),
                published: prev.published + 1,
            }));
        }
    };

    const handleRejectStart = (placeId: string) => {
        const place = places.find((p) => p.id === placeId);
        if (place) setRejectionTarget(place);
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectionTarget) return;
        const placeId = rejectionTarget.id;
        setRejectionTarget(null);

        const idx = places.findIndex((p) => p.id === placeId);
        const removed = idx >= 0 ? places[idx] : null;
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));

        setActionLoading(true);
        const res = await api(`/admin/places/${placeId}/review`, {
            method: 'PATCH',
            body: { status: 'rejected', rejectionReason: reason },
        });
        setActionLoading(false);

        if (res.error) {
            if (removed) setPlaces((prev) => {
                const next = [...prev];
                next.splice(Math.min(idx, next.length), 0, removed);
                return next;
            });
            Alert.alert('Error', `Failed to reject: ${res.error}`);
        } else {
            setCounts((prev) => ({
                ...prev,
                in_review: Math.max(0, prev.in_review - 1),
                rejected: prev.rejected + 1,
            }));
        }
    };

    // ─── Plans logic ───

    const loadPlans = useCallback(async (offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setPlansLoading(true);
        else setPlansLoadingMore(true);

        const res = await api<PlansResponse>(`/admin/plans?source=curated&limit=${PAGE_SIZE}&offset=${offset}`);

        if (res.data) {
            if (isInitial) {
                setPlans(res.data.plans);
            } else {
                setPlans((prev) => [...prev, ...res.data!.plans]);
            }
            setPlansTotal(res.data.total);
        } else if (res.error) {
            Alert.alert('Error', `Failed to load plans: ${res.error}`);
        }

        if (isInitial) setPlansLoading(false);
        else setPlansLoadingMore(false);
    }, []);

    useEffect(() => {
        if (mode === 'plans') loadPlans();
    }, [mode, loadPlans]);

    const handlePlansLoadMore = () => {
        if (plansLoadingMore || plans.length >= plansTotal) return;
        loadPlans(plans.length);
    };

    // ─── Render helpers ───

    const renderPlaceItem = ({ item }: { item: PlaceData }) => (
        <Pressable style={styles.listItem} onPress={() => router.push(`/place/${item.id}`)}>
            {item.photos?.[0] ? (
                <Image source={{ uri: item.photos[0] }} style={styles.listThumb} />
            ) : (
                <View style={[styles.listThumb, { backgroundColor: colors.borderColor }]} />
            )}
            <View style={styles.listInfo}>
                <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.listSub} numberOfLines={1}>
                    {item.category}
                    {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                    {item.priceRange ? ` · ${item.priceRange}` : ''}
                </Text>
            </View>
            <Text style={styles.listChevron}>›</Text>
        </Pressable>
    );

    const renderPlanItem = ({ item }: { item: PlanData }) => (
        <Pressable style={styles.listItem} onPress={() => router.push(`/plans/${item.id}`)}>
            <View style={styles.planIcon}>
                <Text style={styles.planIconText}>{item.durationDays}d</Text>
            </View>
            <View style={styles.listInfo}>
                <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.listSub} numberOfLines={1}>
                    {item.city} · {item.type}
                    {item.isShowcase ? ' · Showcase' : ''}
                </Text>
            </View>
            <View style={styles.planBadges}>
                {item.isPublic && <Text style={styles.publicBadge}>Public</Text>}
            </View>
            <Text style={styles.listChevron}>›</Text>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={[styles.header, isDesktop && styles.headerDesktop]}>
                    <View style={styles.headerLeft}>
                        <Image
                            source={require('../../assets/images/icon-text.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Admin</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Pressable
                            style={styles.createBtn}
                            onPress={() => router.push(mode === 'places' ? '/place/create' : '/plans/create')}
                        >
                            <Text style={styles.createBtnText}>+ Create</Text>
                        </Pressable>
                        <Pressable onPress={signOut} style={styles.logoutBtn}>
                            <Text style={styles.logoutText}>Logout</Text>
                        </Pressable>
                    </View>
                </View>

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
                        {/* Status tabs */}
                        <View style={[styles.tabsRow, isDesktop && styles.tabsRowDesktop]}>
                            {TABS.map((tab) => (
                                <Pressable
                                    key={tab.key}
                                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                                    onPress={() => setActiveTab(tab.key)}
                                >
                                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                                        {tab.label}
                                    </Text>
                                    <View style={[styles.badge, activeTab === tab.key && styles.badgeActive]}>
                                        <Text style={[styles.badgeText, activeTab !== tab.key && styles.badgeTextInactive]}>
                                            {counts[tab.key]}
                                        </Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>

                        {/* Places content */}
                        {loading ? (
                            <View style={styles.centerContentInline}>
                                <ActivityIndicator color={colors.electricBlue} size="large" />
                            </View>
                        ) : activeTab === 'in_review' ? (
                            <View style={styles.deckContainer}>
                                {places.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>All caught up!</Text>
                                        <Pressable onPress={() => loadPlaces('in_review')} style={styles.reloadBtn}>
                                            <Text style={styles.reloadText}>Reload Queue</Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    places.slice(-3).map((place, index, visible) => (
                                        <SwipeCard
                                            key={place.id}
                                            place={place}
                                            isTop={index === visible.length - 1}
                                            onApprove={() => handleApprove(place.id)}
                                            onReject={() => handleRejectStart(place.id)}
                                            showButtons={isDesktop}
                                        />
                                    ))
                                )}
                                {actionLoading && (
                                    <View style={styles.actionIndicator}>
                                        <ActivityIndicator color={colors.electricBlue} size="small" />
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={styles.listContent}>
                                {places.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>
                                            No {activeTab === 'published' ? 'published' : 'rejected'} places
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {places.map((item) => (
                                            <React.Fragment key={item.id}>
                                                {renderPlaceItem({ item })}
                                            </React.Fragment>
                                        ))}
                                        {loadingMore ? (
                                            <ActivityIndicator color={colors.electricBlue} style={{ paddingVertical: 16 }} />
                                        ) : places.length < total ? (
                                            <Pressable style={styles.loadMoreBtn} onPress={handleLoadMore}>
                                                <Text style={styles.loadMoreText}>Load More</Text>
                                            </Pressable>
                                        ) : null}
                                    </>
                                )}
                            </View>
                        )}
                    </>
                ) : (
                    /* Plans content */
                    plansLoading ? (
                        <View style={styles.centerContentInline}>
                            <ActivityIndicator color={colors.electricBlue} size="large" />
                        </View>
                    ) : (
                        <View style={styles.listContent}>
                            {plans.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No plans yet</Text>
                                </View>
                            ) : (
                                <>
                                    {plans.map((item) => (
                                        <React.Fragment key={item.id}>
                                            {renderPlanItem({ item })}
                                        </React.Fragment>
                                    ))}
                                    {plansLoadingMore ? (
                                        <ActivityIndicator color={colors.electricBlue} style={{ paddingVertical: 16 }} />
                                    ) : plans.length < plansTotal ? (
                                        <Pressable style={styles.loadMoreBtn} onPress={handlePlansLoadMore}>
                                            <Text style={styles.loadMoreText}>Load More</Text>
                                        </Pressable>
                                    ) : null}
                                </>
                            )}
                        </View>
                    )
                )}
            </ScrollView>

            <RejectionModal
                visible={!!rejectionTarget}
                placeName={rejectionTarget?.name ?? ''}
                onConfirm={handleRejectConfirm}
                onCancel={() => setRejectionTarget(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgMain },
    scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
    centerContentInline: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

    // Header
    header: {
        paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    headerDesktop: { paddingTop: spacing.lg, maxWidth: 960, alignSelf: 'center', width: '100%' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerLogo: { width: 120, height: 36 },
    title: { fontSize: 20, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    createBtn: {
        backgroundColor: colors.electricBlue, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: borderRadius.sm,
    },
    createBtnText: { color: '#fff', fontFamily: fonts.bodySemiBold, fontSize: 14 },
    logoutBtn: { padding: spacing.sm },
    logoutText: { color: colors.error, fontFamily: fonts.bodySemiBold },

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

    // Tabs
    tabsRow: {
        flexDirection: 'row', paddingHorizontal: 20, gap: spacing.sm, marginBottom: spacing.md,
    },
    tabsRowDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },
    tab: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: 20, borderWidth: 1, borderColor: colors.borderColor,
    },
    tabActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    tabText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
    tabTextActive: { color: '#fff' },
    badge: {
        backgroundColor: colors.borderColor, borderRadius: 10, minWidth: 20, height: 20,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    },
    badgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    badgeText: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#fff' },
    badgeTextInactive: { color: colors.textSecondary },

    // Swipe deck
    deckContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xxl },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyText: { color: colors.textMain, fontSize: 18, fontFamily: fonts.body },
    reloadBtn: {
        marginTop: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderRadius: borderRadius.sm, backgroundColor: colors.electricBlue,
    },
    reloadText: { color: '#fff', fontFamily: fonts.bodySemiBold },
    actionIndicator: { position: 'absolute', bottom: 20 },

    // List view (shared)
    listContent: {
        paddingHorizontal: spacing.md, paddingBottom: 20,
        maxWidth: 960, alignSelf: 'center', width: '100%',
    },
    listItem: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
        borderWidth: 1, borderColor: colors.borderColor,
    },
    listThumb: { width: 52, height: 52, borderRadius: borderRadius.sm },
    listInfo: { flex: 1, marginLeft: spacing.md },
    listName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain, marginBottom: 2 },
    listSub: { fontSize: 13, fontFamily: fonts.body, color: colors.textSecondary },
    listChevron: { fontSize: 22, color: colors.textSecondary, paddingLeft: spacing.sm },

    // Plan-specific
    planIcon: {
        width: 52, height: 52, borderRadius: borderRadius.sm,
        backgroundColor: colors.electricBlueLight, alignItems: 'center', justifyContent: 'center',
    },
    planIconText: { fontSize: 16, fontFamily: fonts.bodyBold, color: colors.electricBlue },
    planBadges: { flexDirection: 'row', gap: spacing.xs, marginRight: spacing.sm },
    publicBadge: {
        fontSize: 11, fontFamily: fonts.bodySemiBold, color: colors.successEmerald,
        backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    },

    // Load more
    loadMoreBtn: {
        alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.electricBlue,
        marginTop: spacing.sm,
    },
    loadMoreText: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 14 },
});
