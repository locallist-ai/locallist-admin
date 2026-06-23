/**
 * Pure logic behind the place edit screen (`usePlaceForm`): the bestFor tag
 * list, the photo list, merging an ES translation draft into the form, and
 * the save orchestration. The dirty diff itself lives in
 * `src/utils/getDirtyFields.ts` (already tested); here the API call is
 * injected so the save decision and its error path are unit-testable.
 */
import type { PlaceData, PlaceTranslateDraft } from '../types/place';

/** Append a trimmed tag, ignoring blanks and duplicates. */
export function addTag(list: string[], raw: string): string[] {
    const tag = raw.trim();
    if (!tag || list.includes(tag)) return list;
    return [...list, tag];
}

export function removeTag(list: string[], tag: string): string[] {
    return list.filter((t) => t !== tag);
}

/** Toggle a trimmed tag in a multi-select list (add if absent, remove if present). */
export function toggleTag(list: string[], raw: string): string[] {
    const tag = raw.trim();
    if (!tag) return list;
    return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
}

/** Append a trimmed photo URL, ignoring blanks (duplicates are allowed). */
export function addPhoto(list: string[], raw: string): string[] {
    const url = raw.trim();
    if (!url) return list;
    return [...list, url];
}

export function removePhoto(list: string[], url: string): string[] {
    return list.filter((p) => p !== url);
}

/**
 * Merge an ES translation draft into the form: each field overwrites only
 * when the draft provides a value (`??`), so a partial draft never wipes
 * fields the model left untouched.
 */
export function applyTranslationDraft(
    form: Partial<PlaceData>,
    draft: PlaceTranslateDraft,
): Partial<PlaceData> {
    return {
        ...form,
        nameEs: draft.nameEs ?? form.nameEs,
        whyThisPlaceEs: draft.whyThisPlaceEs ?? form.whyThisPlaceEs,
        bestTimesEs: draft.bestTimesEs ?? form.bestTimesEs,
        neighborhoodEs: draft.neighborhoodEs ?? form.neighborhoodEs,
        subcategoriesEs: draft.subcategoriesEs ?? form.subcategoriesEs,
        bestForEs: draft.bestForEs ?? form.bestForEs,
        suitableForEs: draft.suitableForEs ?? form.suitableForEs,
    };
}

export interface SavePlaceApiResult {
    data: PlaceData | null;
    error: string | null;
}
export type SavePlaceApi = (
    path: string,
    options: { method: string; body: unknown },
) => Promise<SavePlaceApiResult>;

export type SavePlaceOutcome =
    | { status: 'no-changes' }
    | { status: 'error'; message: string }
    | { status: 'saved'; data: PlaceData };

/**
 * PATCH the dirty fields. `no-changes` short-circuits before any call;
 * success returns the server's canonical place so the caller can reset its
 * baseline; a missing `data` is treated as an error.
 */
export async function savePlace(
    apiCall: SavePlaceApi,
    id: string,
    dirty: Record<string, unknown>,
): Promise<SavePlaceOutcome> {
    if (Object.keys(dirty).length === 0) return { status: 'no-changes' };

    const res = await apiCall(`/admin/places/${id}`, { method: 'PATCH', body: dirty });
    if (res.data) return { status: 'saved', data: res.data };
    return { status: 'error', message: res.error ?? 'unknown error' };
}
