import type { PlaceData } from '../types/place';

export const PLACE_EDITABLE_KEYS: (keyof PlaceData)[] = [
    'name', 'category', 'subcategory', 'whyThisPlace',
    'neighborhood', 'city', 'latitude', 'longitude',
    'bestFor', 'suitableFor', 'bestTime', 'priceRange',
    'photos', 'googlePlaceId', 'source', 'sourceUrl',
];

// Claves numéricas donde el backend puede devolver string por drift de DTOs.
// Coaccionamos a Number antes de comparar para evitar PATCHes espurios como
// "40.4238" (string legacy) vs 40.4238 (number del input parseFloat).
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
