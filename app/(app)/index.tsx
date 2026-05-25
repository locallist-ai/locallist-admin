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
    ActionSheetIOS,
    Platform,
    Modal,
    TextInput,
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
import { CATEGORIES } from '../../src/lib/constants';

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

    // Filter state
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

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

    // Batch translate state
    const [batchProgress, setBatchProgress] = useState<{ label: string; current: number; total: number } | null>(null);
    const batchCancelRef = useRef<AbortController | null>(null);

    // Reindex state
    const [reindexing, setReindexing] = useState(false);

    // Backfill opening hours state
    const [backfillingHours, setBackfillingHours] = useState(false);

    // Refresh state
    const [refreshing, setRefreshing] = useState(false);

    // ─── Places logic ───

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const buildPlacesQuery = useCallback((status: StatusTab, limit: number, offset: number, category?: string | null) => {
        const params = new URLSearchParams();
        params.set('status', status);
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        if (selectedCity) params.set('city', selectedCity);
        if (category) params.set('category', category.toLowerCase());
        if (debouncedSearch) params.set('search', debouncedSearch);
        return `/admin/places?${params}`;
    }, [selectedCity, debouncedSearch]);

    const loadPlaces = useCallback(async (status: StatusTab, offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        const reqId = ++requestIdRef.current;

        const limit = status === 'in_review' ? 10 : PAGE_SIZE;
        const cat = status === 'published' ? selectedCategory : null;
        const res = await api<PlacesResponse>(buildPlacesQuery(status, limit, offset, cat));

        if (reqId !== requestIdRef.current) return;

        if (res.data) {
            if (isInitial) {
                setPlaces(res.data.places);
            } else {
                setPlaces((prev) => [...prev, ...res.data!.places]);
            }
            setTotal(res.data.total);
            // Only update badge counts when NOT filtering by category
            if (!(status === 'published' && selectedCategory)) {
                setCounts((prev) => ({ ...prev, [status]: res.data!.total }));
            }
        } else if (res.error) {
            Alert.alert('Error', `Failed to load places: ${res.error}`);
        }

        if (isInitial) setLoading(false);
        else setLoadingMore(false);
    }, [buildPlacesQuery, selectedCategory]);

    // Fetch available cities
    useEffect(() => {
        api<{ cities: string[] }>('/admin/places/cities').then((res) => {
            if (res.data) setCities(res.data.cities);
        });
    }, []);

    const loadCounts = useCallback(() => {
        if (debouncedSearch) return Promise.resolve();
        return Promise.all(
            TABS.map(async (tab) => {
                const res = await api<PlacesResponse>(buildPlacesQuery(tab.key, 1, 0));
                if (res.data) {
                    setCounts((prev) => ({ ...prev, [tab.key]: res.data!.total }));
                }
            })
        );
    }, [buildPlacesQuery, debouncedSearch]);

    // Fetch counts (respects city filter)
    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        if (mode === 'places') loadPlaces(activeTab);
    }, [activeTab, loadPlaces, mode]);

    const handleCityChange = (city: string | null) => {
        setSelectedCity(city);
    };

    const handleCategoryChange = (category: string | null) => {
        setSelectedCategory(category);
    };

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

    const handlePostpone = async (placeId: string) => {
        const idx = places.findIndex((p) => p.id === placeId);
        if (idx < 0) return;
        const item = places[idx];
        setPlaces((prev) => [item, ...prev.filter((p) => p.id !== placeId)]);

        const res = await api(`/admin/places/${placeId}/postpone`, { method: 'PATCH' });
        if (res.error) {
            setPlaces((prev) => {
                const next = prev.filter((p) => p.id !== placeId);
                next.splice(Math.min(idx, next.length), 0, item);
                return next;
            });
            Alert.alert('Error', `Failed to postpone: ${res.error}`);
        }
    };

    const handlePlaceStatusChange = async (placeId: string, newStatus: StatusTab, reason?: string) => {
        const idx = places.findIndex((p) => p.id === placeId);
        const removed = idx >= 0 ? places[idx] : null;
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));

        const body: Record<string, string> = { status: newStatus };
        if (reason) body.rejectionReason = reason;

        const res = await api(`/admin/places/${placeId}/review`, { method: 'PATCH', body });

        if (res.error) {
            if (removed) setPlaces((prev) => {
                const next = [...prev];
                next.splice(Math.min(idx, next.length), 0, removed);
                return next;
            });
            Alert.alert('Error', `Failed to update: ${res.error}`);
        } else {
            setCounts((prev) => {
                const next = { ...prev };
                next[activeTab] = Math.max(0, next[activeTab] - 1);
                next[newStatus] = next[newStatus] + 1;
                return next;
            });
        }
    };

    const handlePlanUnpublish = async (planId: string) => {
        setPlans((prev) => prev.filter((p) => p.id !== planId));
        const res = await api(`/admin/plans/${planId}`, { method: 'PATCH', body: { isPublic: false } });
        if (res.error) {
            Alert.alert('Error', `Failed to unpublish: ${res.error}`);
            loadPlans();
        }
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

    const handleDeletePlace = (placeId: string) => {
        Alert.alert(
            'Delete Place',
            'This will permanently delete the place. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        const res = await api(`/admin/places/${placeId}?hard=true`, { method: 'DELETE' });
                        if (res.error) {
                            Alert.alert('Error', (res.errorBody as any)?.error ?? res.error);
                        } else {
                            setPlaces((prev) => prev.filter((p) => p.id !== placeId));
                            setCounts((prev) => ({ ...prev, rejected: Math.max(0, prev.rejected - 1) }));
                        }
                    },
                },
            ]
        );
    };

    // ─── Plans logic ───

    const loadPlans = useCallback(async (offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setPlansLoading(true);
        else setPlansLoadingMore(true);

        const res = await api<PlansResponse>(`/admin/plans?isShowcase=true&limit=${PAGE_SIZE}&offset=${offset}`);

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

    const handleDeletePlan = (planId: string) => {
        Alert.alert(
            'Delete Plan',
            'This will permanently delete the plan. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        const res = await api(`/admin/plans/${planId}`, { method: 'DELETE' });
                        if (res.error) {
                            Alert.alert('Error', `Failed to delete: ${res.error}`);
                        } else {
                            setPlans((prev) => prev.filter((p) => p.id !== planId));
                            setPlansTotal((prev) => Math.max(0, prev - 1));
                        }
                    },
                },
            ]
        );
    };

    const runBatchTranslateLoop = async (
        endpoint: '/admin/places/translate-batch' | '/admin/plans/translate-batch',
        label: string,
    ) => {
        const controller = new AbortController();
        batchCancelRef.current = controller;
        let translated = 0;
        let failed = 0;
        let total: number | null = null;
        let consecutiveErrors = 0;

        while (!controller.signal.aborted) {
            const res = await api<{ translated: number; failed: number; skipped: number; remaining: number }>(
                `${endpoint}?limit=10`,
                { method: 'POST', timeoutMs: 60_000, signal: controller.signal },
            );

            if (controller.signal.aborted) break;

            if (!res.data) {
                consecutiveErrors++;
                if (consecutiveErrors >= 3) {
                    setBatchProgress(null);
                    Alert.alert('Error', `Batch translate failed: ${res.error}`);
                    return;
                }
                continue;
            }

            consecutiveErrors = 0;
            translated += res.data.translated;
            failed += res.data.failed;

            if (total === null) {
                total = translated + failed + res.data.skipped + res.data.remaining;
            }

            setBatchProgress({ label, current: translated, total: total ?? translated });

            if (res.data.remaining === 0) break;
        }

        setBatchProgress(null);
        batchCancelRef.current = null;

        if (!controller.signal.aborted) {
            Alert.alert('Done', `Translated: ${translated}, Failed: ${failed}`);
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

    const handleReindex = async () => {
        Alert.alert(
            'Reindex Embeddings',
            'This regenerates vector embeddings for all published places. Takes ~30s. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reindex',
                    onPress: async () => {
                        setReindexing(true);
                        const res = await api<{ reindexed: number; failed: number; total: number }>(
                            '/admin/places/reindex-embeddings',
                            { method: 'POST' }
                        );
                        setReindexing(false);
                        if (res.data) {
                            Alert.alert('Done', `Reindexed: ${res.data.reindexed}/${res.data.total}`);
                        } else {
                            Alert.alert('Error', `Reindex failed: ${res.error}`);
                        }
                    },
                },
            ]
        );
    };

    const handleBackfillHours = async () => {
        Alert.alert(
            'Backfill Opening Hours',
            'Fetches opening hours from Google for all places missing them. May take a while. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Backfill',
                    onPress: async () => {
                        setBackfillingHours(true);
                        const res = await api<{ backfilled: number; failed: number; total: number }>(
                            '/admin/places/backfill-opening-hours?onlyMissing=true&limit=200',
                            { method: 'POST' }
                        );
                        setBackfillingHours(false);
                        if (res.data) {
                            Alert.alert('Done', `Backfilled: ${res.data.backfilled}/${res.data.total} (${res.data.failed} failed)`);
                        } else {
                            Alert.alert('Error', `Backfill failed: ${res.error}`);
                        }
                    },
                },
            ]
        );
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const cityFetch = api<{ cities: string[] }>('/admin/places/cities').then((res) => {
            if (res.data) setCities(res.data.cities);
        });
        if (mode === 'places') {
            await Promise.all([cityFetch, loadCounts(), loadPlaces(activeTab)]);
        } else {
            await Promise.all([cityFetch, loadPlans()]);
        }
        setRefreshing(false);
    };

    // ─── Render helpers ───

    const renderPlaceItem = ({ item }: { item: PlaceData }) => (
        <View style={styles.listItem}>
            <Pressable style={styles.listItemMain} onPress={() => router.push(`/place/${item.id}`)}>
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
            {activeTab !== 'in_review' && (
                <View style={styles.itemActions}>
                    <Pressable
                        style={styles.actionBtnQueue}
                        onPress={() => handlePlaceStatusChange(item.id, 'in_review')}
                    >
                        <Text style={styles.actionBtnQueueText}>Queue</Text>
                    </Pressable>
                    {activeTab === 'published' ? (
                        <Pressable
                            style={styles.actionBtnReject}
                            onPress={() => handleRejectStart(item.id)}
                        >
                            <Text style={styles.actionBtnRejectText}>Reject</Text>
                        </Pressable>
                    ) : (
                        <>
                            <Pressable
                                style={[styles.actionBtnPublish, styles.actionBtnBorderRight]}
                                onPress={() => handlePlaceStatusChange(item.id, 'published')}
                            >
                                <Text style={styles.actionBtnPublishText}>Publish</Text>
                            </Pressable>
                            <Pressable
                                style={styles.actionBtnDelete}
                                onPress={() => handleDeletePlace(item.id)}
                            >
                                <Text style={styles.actionBtnDeleteText}>Delete</Text>
                            </Pressable>
                        </>
                    )}
                </View>
            )}
        </View>
    );

    const renderPlanItem = ({ item }: { item: PlanData }) => (
        <View style={styles.listItem}>
            <Pressable style={styles.listItemMain} onPress={() => router.push(`/plans/${item.id}`)}>
                {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.listThumb} resizeMode="cover" />
                ) : (
                    <View style={styles.planIcon}>
                        <Text style={styles.planIconText}>{item.durationDays}d</Text>
                    </View>
                )}
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
            <View style={styles.itemActions}>
                {item.isPublic && (
                    <Pressable
                        style={[styles.actionBtnReject, styles.actionBtnBorderRight]}
                        onPress={() => handlePlanUnpublish(item.id)}
                    >
                        <Text style={styles.actionBtnRejectText}>Unpublish</Text>
                    </Pressable>
                )}
                <Pressable
                    style={styles.actionBtnDelete}
                    onPress={() => handleDeletePlan(item.id)}
                >
                    <Text style={styles.actionBtnDeleteText}>Delete</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={[styles.header, isDesktop && styles.headerDesktop]}>
                    <Image
                        source={require('../../assets/images/icon-text.png')}
                        style={styles.headerLogo}
                        resizeMode="contain"
                    />
                    <View style={styles.headerRight}>
                        <Pressable
                            style={[styles.refreshBtn, refreshing && { opacity: 0.5 }]}
                            onPress={handleRefresh}
                            disabled={refreshing}
                        >
                            {refreshing
                                ? <ActivityIndicator color={colors.electricBlue} size="small" />
                                : <Text style={styles.refreshBtnText}>⟳</Text>
                            }
                        </Pressable>
                        <Pressable
                            style={styles.createBtn}
                            onPress={() => {
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
                            }}
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

                {/* Search by name */}
                {mode === 'places' && (
                    <View style={styles.searchRow}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name..."
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                            maxLength={100}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear} hitSlop={8}>
                                <Text style={styles.searchClearText}>×</Text>
                            </Pressable>
                        )}
                    </View>
                )}

                {/* City filter (general) */}
                {mode === 'places' && cities.length > 0 && (
                    <View style={isDesktop && styles.filterRowDesktop}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            <Pressable
                                style={[styles.filterChip, !selectedCity && styles.filterChipActive]}
                                onPress={() => handleCityChange(null)}
                            >
                                <Text style={[styles.filterChipText, !selectedCity && styles.filterChipTextActive]}>
                                    All Cities
                                </Text>
                            </Pressable>
                            {cities.map((city) => (
                                <Pressable
                                    key={city}
                                    style={[styles.filterChip, selectedCity === city && styles.filterChipActive]}
                                    onPress={() => handleCityChange(city)}
                                >
                                    <Text style={[styles.filterChipText, selectedCity === city && styles.filterChipTextActive]}>
                                        {city}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {mode === 'places' ? (
                    <>
                        {/* Status tabs */}
                        <View style={[styles.tabsRow, isDesktop && styles.tabsRowDesktop]}>
                            {TABS.map((tab) => (
                                <Pressable
                                    key={tab.key}
                                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                                    onPress={() => {
                                        setActiveTab(tab.key);
                                        if (tab.key !== 'published') setSelectedCategory(null);
                                    }}
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

                        {/* Category filter (published only) */}
                        {activeTab === 'published' && (
                            <View style={isDesktop && styles.filterRowDesktop}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.filterRow}
                                >
                                    <Pressable
                                        style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
                                        onPress={() => handleCategoryChange(null)}
                                    >
                                        <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>
                                            All
                                        </Text>
                                    </Pressable>
                                    {CATEGORIES.map((cat) => (
                                        <Pressable
                                            key={cat}
                                            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                                            onPress={() => handleCategoryChange(selectedCategory === cat ? null : cat)}
                                        >
                                            <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                                                {cat}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Batch translate action (published places only) */}
                        {activeTab === 'published' && (
                            <View style={styles.batchActionsRow}>
                                <Pressable
                                    style={[styles.batchTranslateBtn, { flex: 1 }, !!batchProgress && { opacity: 0.5 }]}
                                    onPress={handleTranslatePlacesBatch}
                                    disabled={!!batchProgress}
                                >
                                    <Text style={styles.batchTranslateBtnText}>Translate → ES</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.reindexBtn, reindexing && { opacity: 0.5 }]}
                                    onPress={handleReindex}
                                    disabled={reindexing}
                                >
                                    {reindexing
                                        ? <ActivityIndicator color={colors.sunsetOrange} size="small" />
                                        : <Text style={[styles.batchTranslateBtnText, { color: colors.sunsetOrange }]}>Reindex</Text>
                                    }
                                </Pressable>
                                <Pressable
                                    style={[styles.reindexBtn, backfillingHours && { opacity: 0.5 }]}
                                    onPress={handleBackfillHours}
                                    disabled={backfillingHours}
                                >
                                    {backfillingHours
                                        ? <ActivityIndicator color={colors.electricBlue} size="small" />
                                        : <Text style={[styles.batchTranslateBtnText, { color: colors.electricBlue }]}>Hours</Text>
                                    }
                                </Pressable>
                            </View>
                        )}

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
                                            onPostpone={() => handlePostpone(place.id)}
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
                    <>
                    <Pressable
                        style={[styles.batchTranslateBtn, !!batchProgress && { opacity: 0.5 }]}
                        onPress={handleTranslatePlansBatch}
                        disabled={!!batchProgress}
                    >
                        <Text style={styles.batchTranslateBtnText}>Translate All Curated → ES</Text>
                    </Pressable>
                    {plansLoading ? (
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
                    )}
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
    centerContentInline: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

    // Header
    header: {
        paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    headerDesktop: { paddingTop: spacing.lg, maxWidth: 960, alignSelf: 'center', width: '100%' },
    headerLogo: { width: 140, height: 40 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    createBtn: {
        backgroundColor: colors.electricBlue, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: borderRadius.sm,
    },
    createBtnText: { color: '#fff', fontFamily: fonts.bodySemiBold, fontSize: 14 },
    refreshBtn: {
        padding: spacing.sm, borderRadius: borderRadius.sm,
        borderWidth: 1, borderColor: colors.electricBlue,
        alignItems: 'center', justifyContent: 'center',
    },
    refreshBtnText: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 18, lineHeight: 20 },
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

    // Filter chips (city & category)
    filterRow: {
        paddingHorizontal: 20, gap: spacing.xs, marginBottom: spacing.md,
    },
    filterRowDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1, borderColor: colors.borderColor,
        backgroundColor: colors.bgCard,
    },
    filterChipActive: {
        backgroundColor: colors.deepOcean, borderColor: colors.deepOcean,
    },
    filterChipText: {
        fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textSecondary,
    },
    filterChipTextActive: { color: '#fff' },

    // Search input
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    },
    searchInput: {
        flex: 1, borderWidth: 1, borderColor: colors.borderColor,
        borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bgCard, color: colors.textMain, fontFamily: fonts.body,
        fontSize: 14,
    },
    searchClear: {
        marginLeft: spacing.sm, minWidth: 32, minHeight: 32,
        alignItems: 'center', justifyContent: 'center',
    },
    searchClearText: { fontSize: 22, color: colors.textSecondary, lineHeight: 26 },

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
    deckContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: spacing.xxl },
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
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderColor,
        overflow: 'hidden',
    },
    listItemMain: {
        flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    },
    listThumb: { width: 52, height: 52, borderRadius: borderRadius.sm },
    listInfo: { flex: 1, marginLeft: spacing.md },
    listName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain, marginBottom: 2 },
    listSub: { fontSize: 13, fontFamily: fonts.body, color: colors.textSecondary },
    listChevron: { fontSize: 22, color: colors.textSecondary, paddingLeft: spacing.sm },

    // Inline status action buttons
    itemActions: {
        flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.borderColor,
    },
    actionBtnQueue: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
        borderRightWidth: 1, borderRightColor: colors.borderColor,
    },
    actionBtnQueueText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.electricBlue },
    actionBtnReject: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    },
    actionBtnRejectText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.error },
    actionBtnPublish: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    },
    actionBtnPublishText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.successEmerald },
    actionBtnBorderRight: {
        borderRightWidth: 1, borderRightColor: colors.borderColor,
    },
    actionBtnDelete: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    },
    actionBtnDeleteText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.error },

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

    // Batch translate
    batchActionsRow: {
        flexDirection: 'row', marginHorizontal: 20, marginBottom: spacing.sm, gap: spacing.sm,
    },
    batchTranslateBtn: {
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.electricBlue,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    },
    reindexBtn: {
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.sunsetOrange,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    },
    batchTranslateBtnText: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 13 },

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
