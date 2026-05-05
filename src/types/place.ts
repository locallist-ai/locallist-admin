/** Matches the AdminPlaceDto returned by GET /admin/places */
export interface PlaceData {
    id: string;
    name: string;
    category: string;
    subcategory?: string;
    neighborhood?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    whyThisPlace: string;
    bestFor?: string[];
    suitableFor?: string[];
    bestTime?: string;
    priceRange?: string;
    photos?: string[];
    googlePlaceId?: string;
    googleRating?: number;
    googleReviewCount?: number;
    source?: string;
    sourceUrl?: string;
    status?: string;
    rejectionReason?: string;
    aiVibeScore?: number;
    flags?: string[];
    createdAt?: string;
    updatedAt?: string;
    // i18n ES fields (curated places only)
    nameEs?: string | null;
    whyThisPlaceEs?: string | null;
    bestTimeEs?: string | null;
    neighborhoodEs?: string | null;
    subcategoryEs?: string | null;
    bestForEs?: string[] | null;
    suitableForEs?: string[] | null;
    translationStatusEs?: string | null;
}

/** Draft returned by POST /admin/places/{id}/translate */
export interface PlaceTranslateDraft {
    nameEs: string | null;
    whyThisPlaceEs: string | null;
    bestTimeEs: string | null;
    neighborhoodEs: string | null;
    subcategoryEs: string | null;
    bestForEs: string[] | null;
    suitableForEs: string[] | null;
}

/** Response from GET /admin/places */
export interface PlacesResponse {
    places: PlaceData[];
    total: number;
}

/** Request body for PATCH /admin/places/{id}/review */
export interface ReviewPlaceRequest {
    status: 'published' | 'rejected';
    rejectionReason?: string;
}

/** One result from POST /admin/places/google-search */
export interface GooglePlacePreview {
    googlePlaceId: string;
    name: string;
    formattedAddress?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    reviewCount?: number;
    priceLevel?: string;
    photos: string[];
    types: string[];
    website?: string;
    phone?: string;
    existsInLib: boolean;
}

export interface GoogleSearchResponse {
    results: GooglePlacePreview[];
}
