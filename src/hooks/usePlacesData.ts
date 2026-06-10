import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import {
    buildPlacesQuery,
    canLoadMore,
    categoryFilterFor,
    pageLimitFor,
    shouldUpdateBadge,
    STATUS_TABS,
    type Mode,
    type StatusTab,
} from '../lib/dashboardQueries';
import { moveToFront, removeById, restoreAt, shiftCount } from '../lib/optimisticList';
import type { PlaceData, PlacesResponse } from '../types/place';

interface UsePlacesDataOptions {
    mode: Mode;
    city: string | null;
    category: string | null;
    /** Already-debounced search term (see useFilterState). */
    search: string;
}

/**
 * Places side of the dashboard: list + pagination + tab badge counts,
 * and the optimistic mutations (approve, reject, postpone, status change,
 * delete) with rollback on API failure.
 */
export function usePlacesData({ mode, city, category, search }: UsePlacesDataOptions) {
    const [activeTab, setActiveTab] = useState<StatusTab>('in_review');
    const [places, setPlaces] = useState<PlaceData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [counts, setCounts] = useState<Record<StatusTab, number>>({ in_review: 0, published: 0, rejected: 0 });
    // Monotonic id so a stale response can never clobber a newer one.
    const requestIdRef = useRef(0);

    const loadPlaces = useCallback(async (status: StatusTab, offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        const reqId = ++requestIdRef.current;

        const res = await api<PlacesResponse>(buildPlacesQuery({
            status,
            limit: pageLimitFor(status),
            offset,
            city,
            category: categoryFilterFor(status, category),
            search,
        }));

        if (reqId !== requestIdRef.current) return;

        if (res.data) {
            if (isInitial) {
                setPlaces(res.data.places);
            } else {
                setPlaces((prev) => [...prev, ...res.data!.places]);
            }
            setTotal(res.data.total);
            if (shouldUpdateBadge(status, category)) {
                setCounts((prev) => ({ ...prev, [status]: res.data!.total }));
            }
        } else if (res.error) {
            Alert.alert('Error', `Failed to load places: ${res.error}`);
        }

        if (isInitial) setLoading(false);
        else setLoadingMore(false);
    }, [city, category, search]);

    const loadCounts = useCallback(() => {
        // While searching, the list shows matches but badges keep global counts.
        if (search) return Promise.resolve();
        return Promise.all(
            STATUS_TABS.map(async (tab) => {
                const res = await api<PlacesResponse>(buildPlacesQuery({ status: tab.key, limit: 1, offset: 0, city }));
                if (res.data) {
                    setCounts((prev) => ({ ...prev, [tab.key]: res.data!.total }));
                }
            })
        );
    }, [city, search]);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        if (mode === 'places') loadPlaces(activeTab);
    }, [activeTab, loadPlaces, mode]);

    const loadMore = () => {
        if (!canLoadMore(loadingMore, places.length, total)) return;
        loadPlaces(activeTab, places.length);
    };

    const approvePlace = async (placeId: string) => {
        const { removed, index } = removeById(places, placeId);
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));

        setActionLoading(true);
        const res = await api(`/admin/places/${placeId}/review`, {
            method: 'PATCH',
            body: { status: 'published' },
        });
        setActionLoading(false);

        if (res.error) {
            if (removed) setPlaces((prev) => restoreAt(prev, removed, index));
            Alert.alert('Error', `Failed to approve: ${res.error}`);
        } else {
            setCounts((prev) => shiftCount(prev, 'in_review', 'published'));
        }
    };

    const postponePlace = async (placeId: string) => {
        const { removed, index } = removeById(places, placeId);
        if (!removed) return;
        setPlaces((prev) => moveToFront(prev, placeId));

        const res = await api(`/admin/places/${placeId}/postpone`, { method: 'PATCH' });
        if (res.error) {
            setPlaces((prev) => restoreAt(prev.filter((p) => p.id !== placeId), removed, index));
            Alert.alert('Error', `Failed to postpone: ${res.error}`);
        }
    };

    const changePlaceStatus = async (placeId: string, newStatus: StatusTab, reason?: string) => {
        const { removed, index } = removeById(places, placeId);
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));

        const body: Record<string, string> = { status: newStatus };
        if (reason) body.rejectionReason = reason;

        const res = await api(`/admin/places/${placeId}/review`, { method: 'PATCH', body });

        if (res.error) {
            if (removed) setPlaces((prev) => restoreAt(prev, removed, index));
            Alert.alert('Error', `Failed to update: ${res.error}`);
        } else {
            setCounts((prev) => shiftCount(prev, activeTab, newStatus));
        }
    };

    const rejectPlace = async (placeId: string, reason: string) => {
        const { removed, index } = removeById(places, placeId);
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));

        setActionLoading(true);
        const res = await api(`/admin/places/${placeId}/review`, {
            method: 'PATCH',
            body: { status: 'rejected', rejectionReason: reason },
        });
        setActionLoading(false);

        if (res.error) {
            if (removed) setPlaces((prev) => restoreAt(prev, removed, index));
            Alert.alert('Error', `Failed to reject: ${res.error}`);
        } else {
            setCounts((prev) => shiftCount(prev, 'in_review', 'rejected'));
        }
    };

    const deletePlace = (placeId: string) => {
        Alert.alert(
            'Delete Place',
            'This will permanently delete the place. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        const res = await api(`/admin/places/${placeId}?hard=true`, { method: 'DELETE' });
                        if (res.error) {
                            Alert.alert('Error', (res.errorBody as { error?: string } | null)?.error ?? res.error);
                        } else {
                            setPlaces((prev) => prev.filter((p) => p.id !== placeId));
                            setCounts((prev) => shiftCount(prev, 'rejected', null));
                        }
                    },
                },
            ]
        );
    };

    return {
        activeTab,
        setActiveTab,
        places,
        total,
        loading,
        loadingMore,
        actionLoading,
        counts,
        loadPlaces,
        loadCounts,
        loadMore,
        approvePlace,
        postponePlace,
        changePlaceStatus,
        rejectPlace,
        deletePlace,
    };
}
