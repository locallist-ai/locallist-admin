import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Dashboard filter state: city, category, and name search with debounce.
 * Consumers should query with `debouncedSearch`, never with the raw input.
 */
export function useFilterState() {
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const loadCities = useCallback(async () => {
        const res = await api<{ cities: string[] }>('/admin/places/cities');
        if (res.data) setCities(res.data.cities);
    }, []);

    useEffect(() => {
        loadCities();
    }, [loadCities]);

    return {
        cities,
        loadCities,
        selectedCity,
        setSelectedCity,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        debouncedSearch,
    };
}
