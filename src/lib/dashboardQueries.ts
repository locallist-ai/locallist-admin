/**
 * Pure query/pagination helpers for the dashboard (app/(app)/index.tsx).
 * Extracted so the filter and paging rules are unit-testable in vitest,
 * which is scoped to pure TS (native modules don't resolve in Node).
 */

export type Mode = 'places' | 'plans';
export type StatusTab = 'in_review' | 'published' | 'rejected';

export const STATUS_TABS: { key: StatusTab; label: string }[] = [
    { key: 'in_review', label: 'Queue' },
    { key: 'published', label: 'Published' },
    { key: 'rejected', label: 'Rejected' },
];

export const PAGE_SIZE = 20;
/** The swipe queue loads a short deck instead of a full page. */
export const QUEUE_PAGE_SIZE = 10;

export function pageLimitFor(status: StatusTab): number {
    return status === 'in_review' ? QUEUE_PAGE_SIZE : PAGE_SIZE;
}

/** The category filter only exists on the Published tab. */
export function categoryFilterFor(status: StatusTab, selectedCategory: string | null): string | null {
    return status === 'published' ? selectedCategory : null;
}

/**
 * Badge counts reflect totals unfiltered by category: a category filter
 * narrows the list, but the tab badge keeps the full count.
 */
export function shouldUpdateBadge(status: StatusTab, selectedCategory: string | null): boolean {
    return !(status === 'published' && selectedCategory);
}

export interface PlacesQueryOptions {
    status: StatusTab;
    limit: number;
    offset: number;
    city?: string | null;
    category?: string | null;
    search?: string;
}

export function buildPlacesQuery({ status, limit, offset, city, category, search }: PlacesQueryOptions): string {
    const params = new URLSearchParams();
    params.set('status', status);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (city) params.set('city', city);
    if (category) params.set('category', category.toLowerCase());
    if (search) params.set('search', search);
    return `/admin/places?${params}`;
}

export function buildPlansQuery(limit: number, offset: number): string {
    return `/admin/plans?isShowcase=true&limit=${limit}&offset=${offset}`;
}

/** Guard for "Load More": never double-fire, never page past the total. */
export function canLoadMore(isLoadingMore: boolean, loadedCount: number, total: number): boolean {
    return !isLoadingMore && loadedCount < total;
}

export type RefreshTask = 'cities' | 'counts' | 'places' | 'plans';

/** Manual refresh refetches only what the active mode displays. */
export function refreshTasksFor(mode: Mode): RefreshTask[] {
    return mode === 'places' ? ['cities', 'counts', 'places'] : ['cities', 'plans'];
}
