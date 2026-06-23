export { CATEGORIES, getSubcategories, inferSubcategoryFromGoogleTypes } from './taxonomy';
export type { Category } from './taxonomy';

export const PRICE_RANGES = ['FREE', '$', '$$', '$$$', '$$$$'] as const;
export const BEST_TIMES = ['morning', 'lunch', 'afternoon', 'dinner', 'late_night'] as const;
// Provisional list; Pablo tunes it. The form also keeps any legacy free-form
// value already stored on a place even if it is not in this list.
export const BEST_FOR = ['solo', 'couples', 'families', 'friends', 'groups', 'kids', 'business'] as const;
export const STATUSES = ['published', 'in_review', 'draft'] as const;
export const MAX_STOPS_PER_DAY = 10;
