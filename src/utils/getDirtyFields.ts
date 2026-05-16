import type { PlaceData } from '../types/place';

export const PLACE_EDITABLE_KEYS: (keyof PlaceData)[] = [
    'name', 'category', 'subcategory', 'whyThisPlace',
    'neighborhood', 'city', 'latitude', 'longitude',
    'bestFor', 'suitableFor', 'bestTime', 'priceRange',
    'photos', 'googlePlaceId', 'source', 'sourceUrl',
];

// Numeric keys where the backend may return a string due to DTO drift.
// Coerce to Number before comparing to avoid spurious PATCHes like
// "40.4238" (legacy string) vs 40.4238 (number from parseFloat).
const NUMERIC_KEYS = new Set<keyof PlaceData>(['latitude', 'longitude']);

export function getDirtyFields(
    original: PlaceData,
    form: Partial<PlaceData>,
): Record<string, unknown> {
    const dirty: Record<string, unknown> = {};

    for (const key of PLACE_EDITABLE_KEYS) {
        const formVal = form[key];
        const origVal = original[key];

        if (Array.isArray(formVal) && Array.isArray(origVal)) {
            if (JSON.stringify(formVal) !== JSON.stringify(origVal)) {
                dirty[key] = formVal;
            }
            continue;
        }

        if (NUMERIC_KEYS.has(key) && formVal != null && origVal != null) {
            const f = Number(formVal);
            const o = Number(origVal);
            const bothNaN = Number.isNaN(f) && Number.isNaN(o);
            if (!bothNaN && f !== o) {
                dirty[key] = formVal;
            }
            continue;
        }

        if (formVal !== origVal) {
            dirty[key] = formVal;
        }
    }

    return dirty;
}
