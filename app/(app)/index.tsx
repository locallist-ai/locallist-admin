import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import SwipeCard from '../../src/components/SwipeCard';
import RejectionModal from '../../src/components/RejectionModal';
import type { PlaceData, PlacesResponse } from '../../src/types/place';

type StatusTab = 'in_review' | 'published' | 'rejected';

const TABS: { key: StatusTab; label: string }[] = [
    { key: 'in_review', label: 'Queue' },
    { key: 'published', label: 'Published' },
    { key: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE = 20;

const colors = {
    deepOcean: '#0f172a',
    surface: '#1e293b',
    border: '#334155',
    electricBlue: '#3b82f6',
    paperWhite: '#F2EFE9',
    textSecondary: '#94a3b8',
    successEmerald: '#10b981',
    error: '#ef4444',
    sunsetOrange: '#f97316',
};

export default function DashboardScreen() {
    const { signOut } = useAuth();
    const router = useRouter();
    const { isDesktop } = useBreakpoint();

    const [activeTab, setActiveTab] = useState<StatusTab>('in_review');
    const [places, setPlaces] = useState<PlaceData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Counts per tab
    const [counts, setCounts] = useState<Record<StatusTab, number>>({ in_review: 0, published: 0, rejected: 0 });

    // Rejection modal
    const [rejectionTarget, setRejectionTarget] = useState<PlaceData | null>(null);

    // H6 fix: track request sequence to prevent stale responses from overwriting current data
    const requestIdRef = useRef(0);

    const loadPlaces = useCallback(async (status: StatusTab, offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        const reqId = ++requestIdRef.current;

        const limit = status === 'in_review' ? 10 : PAGE_SIZE;
        const res = await api<PlacesResponse>(
            `/admin/places?status=${status}&limit=${limit}&offset=${offset}`
        );

        // Discard stale responses from previous tab switches
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

    // Load counts for all tabs on mount (parallel)
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
        loadPlaces(activeTab);
    }, [activeTab, loadPlaces]);

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
            // Restore card at its original position
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

    const renderListItem = ({ item }: { item: PlaceData }) => (
        <Pressable style={styles.listItem} onPress={() => router.push(`/place/${item.id}`)}>
            {item.photos?.[0] ? (
                <Image source={{ uri: item.photos[0] }} style={styles.listThumb} />
            ) : (
                <View style={[styles.listThumb, { backgroundColor: colors.border }]} />
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

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, isDesktop && styles.headerDesktop]}>
                <Text style={styles.title}>LocalList Admin</Text>
                <Pressable onPress={signOut} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
            </View>

            {/* Tabs */}
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
                            <Text style={styles.badgeText}>{counts[tab.key]}</Text>
                        </View>
                    </Pressable>
                ))}
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator color={colors.electricBlue} size="large" />
                </View>
            ) : activeTab === 'in_review' ? (
                /* Swipe card queue */
                <View style={styles.deckContainer}>
                    {places.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>All caught up!</Text>
                            <Pressable
                                onPress={() => loadPlaces('in_review')}
                                style={styles.reloadBtn}
                            >
                                <Text style={styles.reloadText}>Reload Queue</Text>
                            </Pressable>
                        </View>
                    ) : (
                        // Only render top 3 cards for performance (rest are invisible anyway)
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
                /* List view for published/rejected */
                <FlatList
                    data={places}
                    keyExtractor={(item) => item.id}
                    renderItem={renderListItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator
                                color={colors.electricBlue}
                                style={{ paddingVertical: 16 }}
                            />
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                No {activeTab === 'published' ? 'published' : 'rejected'} places
                            </Text>
                        </View>
                    }
                />
            )}

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
    container: {
        flex: 1,
        backgroundColor: colors.deepOcean,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerDesktop: {
        paddingTop: 24,
        maxWidth: 960,
        alignSelf: 'center',
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.paperWhite,
    },
    logoutBtn: {
        padding: 8,
    },
    logoutText: {
        color: colors.error,
        fontWeight: '600',
    },

    // Tabs
    tabsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 8,
        marginBottom: 12,
    },
    tabsRowDesktop: {
        maxWidth: 960,
        alignSelf: 'center',
        width: '100%',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabActive: {
        backgroundColor: colors.electricBlue,
        borderColor: colors.electricBlue,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    tabTextActive: {
        color: '#fff',
    },
    badge: {
        backgroundColor: colors.border,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },

    // Swipe deck
    deckContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: colors.paperWhite,
        fontSize: 18,
    },
    reloadBtn: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: colors.electricBlue,
    },
    reloadText: {
        color: colors.paperWhite,
        fontWeight: '600',
    },
    actionIndicator: {
        position: 'absolute',
        bottom: 20,
    },

    // List view
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        maxWidth: 960,
        alignSelf: 'center',
        width: '100%',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    listThumb: {
        width: 52,
        height: 52,
        borderRadius: 8,
    },
    listInfo: {
        flex: 1,
        marginLeft: 12,
    },
    listName: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.paperWhite,
        marginBottom: 2,
    },
    listSub: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    listChevron: {
        fontSize: 22,
        color: colors.textSecondary,
        paddingLeft: 8,
    },
});
