export const CATEGORIES = ['Food', 'Nightlife', 'Coffee', 'Outdoors', 'Wellness', 'Culture'] as const;
export type Category = typeof CATEGORIES[number];

export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'] as const;
export const BEST_TIMES = ['morning', 'lunch', 'afternoon', 'dinner', 'late_night'] as const;
export const STATUSES = ['published', 'in_review', 'draft'] as const;
