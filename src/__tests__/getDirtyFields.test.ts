/**
 * Tests de `getDirtyFields` — utility extraída a `src/utils/getDirtyFields.ts`
 * y consumida por `app/(app)/place/[id].tsx` (pantalla de edición de lugares).
 *
 * El bug de comparación estricta string↔number en lat/lon (PATCHes espurios
 * cuando el backend devolvía coords como string) está corregido: la utility
 * coacciona a `Number()` para las claves numéricas antes de comparar.
 */
import { describe, it, expect } from 'vitest';
import type { PlaceData } from '../types/place';
import { getDirtyFields } from '../utils/getDirtyFields';

const basePlace: PlaceData = {
    id: 'abc-123',
    name: 'Café Central',
    category: 'Coffee',
    subcategory: 'Specialty coffee',
    whyThisPlace: 'Tostadores propios',
    neighborhood: 'Chueca',
    city: 'Madrid',
    latitude: 40.4238,
    longitude: -3.6977,
    bestFor: ['work', 'brunch'],
    suitableFor: ['solo', 'couples'],
    bestTime: 'morning',
    priceRange: '$$',
    photos: ['https://example.com/a.jpg'],
    googlePlaceId: 'gpid-xyz',
    source: 'curator',
    sourceUrl: 'https://example.com',
    status: 'in_review',
};

describe('getDirtyFields', () => {
    it('happy path: devuelve solo el campo modificado', () => {
        const form: Partial<PlaceData> = {
            ...basePlace,
            name: 'Café Central (Renovado)',
        };
        const dirty = getDirtyFields(basePlace, form);
        expect(dirty).toEqual({ name: 'Café Central (Renovado)' });
        expect(Object.keys(dirty)).toHaveLength(1);
    });

    it('detecta cambios en arrays mediante JSON.stringify', () => {
        const form: Partial<PlaceData> = {
            ...basePlace,
            bestFor: ['work', 'brunch', 'dates'],
        };
        const dirty = getDirtyFields(basePlace, form);
        expect(dirty).toEqual({ bestFor: ['work', 'brunch', 'dates'] });
    });

    it('form idéntico al original -> dirty vacío', () => {
        const form: Partial<PlaceData> = { ...basePlace };
        expect(getDirtyFields(basePlace, form)).toEqual({});
    });

    it('latitude string "40.4238" vs number 40.4238 NO es dirty (bug corregido)', () => {
        const original: PlaceData = {
            ...basePlace,
            latitude: '40.4238' as unknown as number,
        };
        const form: Partial<PlaceData> = {
            ...basePlace,
            latitude: 40.4238,
        };
        const dirty = getDirtyFields(original, form);
        expect(dirty).not.toHaveProperty('latitude');
    });

    it('longitude string "-3.6977" vs number -3.6977 NO es dirty (bug corregido)', () => {
        const original: PlaceData = {
            ...basePlace,
            longitude: '-3.6977' as unknown as number,
        };
        const form: Partial<PlaceData> = {
            ...basePlace,
            longitude: -3.6977,
        };
        const dirty = getDirtyFields(original, form);
        expect(dirty).not.toHaveProperty('longitude');
    });

    it('control: lat number→number con valor distinto SÍ es dirty', () => {
        const form: Partial<PlaceData> = {
            ...basePlace,
            latitude: 40.5,
        };
        expect(getDirtyFields(basePlace, form)).toEqual({ latitude: 40.5 });
    });

    it('control: lon con valor ilegible en ambos lados no marca dirty', () => {
        const original: PlaceData = {
            ...basePlace,
            longitude: 'abc' as unknown as number,
        };
        const form: Partial<PlaceData> = {
            ...basePlace,
            longitude: 'abc' as unknown as number,
        };
        expect(getDirtyFields(original, form)).toEqual({});
    });
});
