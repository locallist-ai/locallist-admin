import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface SubcategoryItem {
    id: string;
    categoryKey: string;
    key: string;
    labelEn: string;
    labelEs: string;
    createdAt: string;
    updatedAt: string;
}

type ByCategory = Record<string, SubcategoryItem[]>;

interface TaxonomyState {
    subs: SubcategoryItem[];
    byCategory: ByCategory;
    loading: boolean;
    error: string | null;
}

// Module-level cache so all components share the same fetch
let cached: SubcategoryItem[] | null = null;
let cachedAt: number | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5 min in-memory

function buildByCategory(subs: SubcategoryItem[]): ByCategory {
    const result: ByCategory = {};
    for (const s of subs) {
        if (!result[s.categoryKey]) result[s.categoryKey] = [];
        result[s.categoryKey].push(s);
    }
    return result;
}

export function useTaxonomy() {
    const [state, setState] = useState<TaxonomyState>(() => {
        if (cached) {
            return { subs: cached, byCategory: buildByCategory(cached), loading: false, error: null };
        }
        return { subs: [], byCategory: {}, loading: true, error: null };
    });

    const fetchTaxonomy = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && cached && cachedAt && now - cachedAt < CACHE_MS) {
            setState({ subs: cached, byCategory: buildByCategory(cached), loading: false, error: null });
            return;
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        const res = await api<SubcategoryItem[]>('/admin/subcategories');
        if (res.data) {
            cached = res.data;
            cachedAt = Date.now();
            setState({ subs: res.data, byCategory: buildByCategory(res.data), loading: false, error: null });
        } else {
            setState((prev) => ({ ...prev, loading: false, error: res.error }));
        }
    }, []);

    const createSubcategory = useCallback(async (payload: {
        categoryKey: string;
        key: string;
        labelEn: string;
        labelEs: string;
    }): Promise<SubcategoryItem> => {
        const res = await api<SubcategoryItem>('/admin/subcategories', { method: 'POST', body: payload });
        if (!res.data) {
            throw new Error(res.error ?? 'Failed to create subcategory.');
        }
        cached = null; // invalidate
        await fetchTaxonomy(true);
        return res.data;
    }, [fetchTaxonomy]);

    useEffect(() => {
        fetchTaxonomy();
    }, [fetchTaxonomy]);

    return {
        subs: state.subs,
        byCategory: state.byCategory,
        loading: state.loading,
        error: state.error,
        refetch: () => fetchTaxonomy(true),
        createSubcategory,
    };
}
