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
