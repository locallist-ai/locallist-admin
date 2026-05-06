export { CATEGORIES, SUBCATEGORIES_BY_CATEGORY, getSubcategories, inferSubcategoryFromGoogleTypes } from './taxonomy';
export type { Category } from './taxonomy';

export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'] as const;
export const BEST_TIMES = ['morning', 'lunch', 'afternoon', 'dinner', 'late_night'] as const;
export const STATUSES = ['published', 'in_review', 'draft'] as const;
