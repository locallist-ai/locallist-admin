export const CATEGORIES = [
    'Food', 'Nightlife', 'Coffee', 'Outdoors', 'Wellness', 'Culture', 'Shopping',
] as const;

export type Category = typeof CATEGORIES[number];

export const SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
    Food:     ['Ramen', 'Sushi', 'Italian', 'Pizza', 'Mexican', 'Tacos', 'Cuban', 'Latin American', 'American', 'Steakhouse', 'Seafood', 'Mediterranean', 'Asian Fusion', 'Brunch', 'Bakery', 'Vegan'],
    Nightlife: ['Cocktail Bar', 'Speakeasy', 'Rooftop Bar', 'Wine Bar', 'Sports Bar', 'Beer Bar', 'Nightclub', 'Live Music'],
    Coffee:   ['Specialty Coffee', 'Espresso Bar', 'Bakery Café', 'Tea House', 'Juice Bar', 'Dessert'],
    Outdoors: ['Beach', 'Park', 'Garden', 'Trail', 'Marina', 'Pier', 'Waterfront', 'Dog Park'],
    Wellness: ['Spa', 'Pilates', 'Yoga', 'Gym', 'Sauna', 'IV Therapy', 'Massage', 'Salt Cave'],
    Culture:  ['Museum', 'Gallery', 'Theater', 'Music Venue', 'Festival Site', 'Historic Site', 'Public Art', 'Cultural Center'],
    Shopping: ['Boutique', 'Vintage', 'Bookstore', 'Record Store', 'Concept Store', 'Market', 'Florist', 'Designer'],
};

export const GOOGLE_TYPES_TO_SUBCATEGORY: Record<string, string> = {
    ramen_restaurant: 'Ramen',
    sushi_restaurant: 'Sushi',
    japanese_restaurant: 'Sushi',
    italian_restaurant: 'Italian',
    pizza_restaurant: 'Pizza',
    mexican_restaurant: 'Mexican',
    american_restaurant: 'American',
    hamburger_restaurant: 'American',
    steak_house: 'Steakhouse',
    seafood_restaurant: 'Seafood',
    mediterranean_restaurant: 'Mediterranean',
    asian_restaurant: 'Asian Fusion',
    korean_restaurant: 'Asian Fusion',
    chinese_restaurant: 'Asian Fusion',
    thai_restaurant: 'Asian Fusion',
    vietnamese_restaurant: 'Asian Fusion',
    brunch_restaurant: 'Brunch',
    breakfast_restaurant: 'Brunch',
    bakery: 'Bakery',
    vegan_restaurant: 'Vegan',
    cuban_restaurant: 'Cuban',
    latin_american_restaurant: 'Latin American',
    bar: 'Cocktail Bar',
    cocktail_bar: 'Cocktail Bar',
    wine_bar: 'Wine Bar',
    sports_bar: 'Sports Bar',
    night_club: 'Nightclub',
    coffee_shop: 'Specialty Coffee',
    cafe: 'Specialty Coffee',
    tea_house: 'Tea House',
    dessert_shop: 'Dessert',
    ice_cream_shop: 'Dessert',
    juice_shop: 'Juice Bar',
    beach: 'Beach',
    park: 'Park',
    national_park: 'Park',
    botanical_garden: 'Garden',
    marina: 'Marina',
    pier: 'Pier',
    dog_park: 'Dog Park',
    hiking_area: 'Trail',
    spa: 'Spa',
    yoga_studio: 'Yoga',
    gym: 'Gym',
    fitness_center: 'Gym',
    massage: 'Massage',
    pilates_studio: 'Pilates',
    museum: 'Museum',
    art_gallery: 'Gallery',
    theater: 'Theater',
    performing_arts_theater: 'Theater',
    event_venue: 'Music Venue',
    concert_hall: 'Music Venue',
    cultural_center: 'Cultural Center',
    historical_landmark: 'Historic Site',
    monument: 'Historic Site',
    clothing_store: 'Boutique',
    book_store: 'Bookstore',
    market: 'Market',
    florist: 'Florist',
    department_store: 'Concept Store',
    shopping_mall: 'Concept Store',
    record_store: 'Record Store',
};

export function getSubcategories(category: string): string[] {
    return SUBCATEGORIES_BY_CATEGORY[category] ?? [];
}

export function inferSubcategoryFromGoogleTypes(
    category: string,
    googleTypes: string[],
    placeName?: string,
): string | null {
    if (category === 'Food' && placeName?.toLowerCase().includes('taco')) return 'Tacos';
    const allowed = SUBCATEGORIES_BY_CATEGORY[category] ?? [];
    for (const type of googleTypes) {
        const candidate = GOOGLE_TYPES_TO_SUBCATEGORY[type];
        if (candidate && allowed.includes(candidate)) return candidate;
    }
    return null;
}
