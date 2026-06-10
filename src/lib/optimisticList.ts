/**
 * Pure list/count operations behind the dashboard's optimistic updates.
 * The UI removes an item before the API confirms; on failure the item is
 * restored at (or as close as possible to) its original position.
 */

interface HasId {
    id: string;
}

export interface RemovalResult<T> {
    next: T[];
    removed: T | null;
    index: number;
}

export function removeById<T extends HasId>(list: T[], id: string): RemovalResult<T> {
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return { next: list, removed: null, index };
    return { next: list.filter((item) => item.id !== id), removed: list[index], index };
}

/** Restore a removed item, clamping the index in case the list shrank meanwhile. */
export function restoreAt<T>(list: T[], item: T, index: number): T[] {
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, item);
    return next;
}

/** Postpone: send the item to the front of the deck (top renders last). */
export function moveToFront<T extends HasId>(list: T[], id: string): T[] {
    const item = list.find((i) => i.id === id);
    if (!item) return list;
    return [item, ...list.filter((i) => i.id !== id)];
}

/** Move one unit between status buckets; counts never go negative. */
export function shiftCount<C extends Record<string, number>>(
    counts: C,
    from: keyof C | null,
    to: keyof C | null,
): C {
    const next: Record<string, number> = { ...counts };
    if (from) next[from as string] = Math.max(0, next[from as string] - 1);
    if (to) next[to as string] = next[to as string] + 1;
    return next as C;
}
