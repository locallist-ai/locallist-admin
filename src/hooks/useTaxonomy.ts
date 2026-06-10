import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import {
    postSubcategoriesBatch,
    type BatchCreateResult,
    type CreateSubcategoryPayload,
    type SubcategoryItem,
} from '../lib/subcategories';

export type { SubcategoryItem } from '../lib/subcategories';

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

// Every mounted hook instance subscribes its setState here, so a successful
// fetch from any screen (e.g. creating a subcategory in the place editor)
// refreshes the pickers everywhere instead of waiting for remount/TTL.
const subscribers = new Set<(state: TaxonomyState) => void>();

function broadcast(state: TaxonomyState) {
    for (const notify of subscribers) notify(state);
}

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
            // Broadcast (not setState): every mounted instance gets the update
            broadcast({ subs: res.data, byCategory: buildByCategory(res.data), loading: false, error: null });
        } else {
            setState((prev) => ({ ...prev, loading: false, error: res.error }));
        }
    }, []);

    // Creates each subcategory individually but refetches the taxonomy only
    // once at the end. Partial failures are returned, never thrown, so the
    // caller can keep the rows that did get created.
    const createSubcategories = useCallback(async (
        payloads: CreateSubcategoryPayload[],
    ): Promise<BatchCreateResult> => {
        const result = await postSubcategoriesBatch(payloads);
        if (result.created.length > 0) {
            cached = null; // invalidate
            await fetchTaxonomy(true);
        }
        return result;
    }, [fetchTaxonomy]);

    // Subscribe before the initial fetch so its broadcast reaches this instance
    useEffect(() => {
        subscribers.add(setState);
        return () => {
            subscribers.delete(setState);
        };
    }, []);

    useEffect(() => {
        fetchTaxonomy();
    }, [fetchTaxonomy]);

    return {
        subs: state.subs,
        byCategory: state.byCategory,
        loading: state.loading,
        error: state.error,
        createSubcategories,
    };
}
