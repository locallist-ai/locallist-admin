import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import { buildPlansQuery, canLoadMore, PAGE_SIZE, type Mode } from '../lib/dashboardQueries';
import type { PlanData, PlansResponse } from '../types/plan';

/**
 * Plans side of the dashboard: showcase list + pagination, plus the
 * unpublish (optimistic, reload on failure) and delete actions.
 */
export function usePlansData({ mode }: { mode: Mode }) {
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadPlans = useCallback(async (offset = 0) => {
        const isInitial = offset === 0;
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        const res = await api<PlansResponse>(buildPlansQuery(PAGE_SIZE, offset));

        if (res.data) {
            if (isInitial) {
                setPlans(res.data.plans);
            } else {
                setPlans((prev) => [...prev, ...res.data!.plans]);
            }
            setTotal(res.data.total);
        } else if (res.error) {
            Alert.alert('Error', `Failed to load plans: ${res.error}`);
        }

        if (isInitial) setLoading(false);
        else setLoadingMore(false);
    }, []);

    useEffect(() => {
        if (mode === 'plans') loadPlans();
    }, [mode, loadPlans]);

    const loadMore = () => {
        if (!canLoadMore(loadingMore, plans.length, total)) return;
        loadPlans(plans.length);
    };

    const unpublishPlan = async (planId: string) => {
        setPlans((prev) => prev.filter((p) => p.id !== planId));
        const res = await api(`/admin/plans/${planId}`, { method: 'PATCH', body: { isPublic: false } });
        if (res.error) {
            Alert.alert('Error', `Failed to unpublish: ${res.error}`);
            loadPlans();
        }
    };

    const deletePlan = (planId: string) => {
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
                            setTotal((prev) => Math.max(0, prev - 1));
                        }
                    },
                },
            ]
        );
    };

    return {
        plans,
        total,
        loading,
        loadingMore,
        loadPlans,
        loadMore,
        unpublishPlan,
        deletePlan,
    };
}
