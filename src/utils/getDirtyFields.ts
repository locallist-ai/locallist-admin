import type { PlaceData } from '../types/place';

// Every field the edit form can change. The PATCH endpoint only binds
// `subcategories` (plural) — the deprecated singular `subcategory` adapter
// is ignored by the API and must never be diffed here: keys missing from
// this list are silently dropped on save.
export const PLACE_EDITABLE_KEYS: (keyof PlaceData)[] = [
    'name', 'category', 'subcategories', 'whyThisPlace',
    'neighborhood', 'city', 'latitude', 'longitude',
    'bestFor', 'suitableFor', 'bestTime', 'priceRange',
    'photos', 'googlePlaceId', 'source', 'sourceUrl',
    'visitDurationMin',
    // i18n ES fields
    'nameEs', 'whyThisPlaceEs', 'bestTimeEs', 'neighborhoodEs',
    'subcategoriesEs', 'bestForEs', 'suitableForEs', 'translationStatusEs',
];

// Numeric keys where the backend may return a string due to DTO drift.
// Coerce to Number before comparing to avoid spurious PATCHes like
// "40.4238" (legacy string) vs 40.4238 (number from parseFloat).
const NUMERIC_KEYS = new Set<keyof PlaceData>(['latitude', 'longitude', 'visitDurationMin']);

// i18n ES fields follow "null = no change, empty = clear" in the PATCH API,
// but the form stores cleared inputs as null. Normalize dirty nulls to the
// clearing sentinel so the user can actually erase a translation.
const I18N_STRING_KEYS = new Set<keyof PlaceData>([
    'nameEs', 'whyThisPlaceEs', 'bestTimeEs', 'neighborhoodEs',
]);
const I18N_LIST_KEYS = new Set<keyof PlaceData>([
    'subcategoriesEs', 'bestForEs', 'suitableForEs',
]);

// Numeric fields where the API also treats null as "no change" but accepts
// 0 as the clearing sentinel (a real visit can't last 0 minutes). The form
// stores a cleared input as null; send 0 so the value actually clears.
const CLEAR_ZERO_KEYS = new Set<keyof PlaceData>(['visitDurationMin']);

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
            if (formVal == null && I18N_STRING_KEYS.has(key)) {
                dirty[key] = '';
            } else if (formVal == null && I18N_LIST_KEYS.has(key)) {
                dirty[key] = [];
            } else if (formVal == null && CLEAR_ZERO_KEYS.has(key)) {
                dirty[key] = 0;
            } else {
                dirty[key] = formVal;
            }
        }
    }

    return dirty;
}
