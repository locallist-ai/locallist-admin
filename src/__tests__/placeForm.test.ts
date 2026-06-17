/**
 * Tests de la lógica pura del editor de lugares (`src/lib/placeForm.ts`):
 * tags bestFor, fotos, merge del borrador de traducción ES y la orquestación
 * del save con la API inyectada, incluido su camino de error. El diff de
 * campos sucios se prueba aparte en getDirtyFields.test.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    addPhoto,
    addTag,
    applyTranslationDraft,
    removePhoto,
    removeTag,
    savePlace,
    type SavePlaceApi,
} from '../lib/placeForm';
import type { PlaceData, PlaceTranslateDraft } from '../types/place';

describe('addTag / removeTag', () => {
    it('añade el tag recortado', () => {
        expect(addTag(['a'], '  b ')).toEqual(['a', 'b']);
    });

    it('ignora vacío y duplicado (misma referencia)', () => {
        const list = ['a'];
        expect(addTag(list, '   ')).toBe(list);
        expect(addTag(list, 'a')).toBe(list);
    });

    it('quita el tag', () => {
        expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
    });
});

describe('addPhoto / removePhoto', () => {
    it('añade la URL recortada y permite duplicados', () => {
        expect(addPhoto(['u'], ' v ')).toEqual(['u', 'v']);
        expect(addPhoto(['u'], 'u')).toEqual(['u', 'u']);
    });

    it('ignora URL vacía (misma referencia)', () => {
        const list = ['u'];
        expect(addPhoto(list, '   ')).toBe(list);
    });

    it('quita la URL', () => {
        expect(removePhoto(['u', 'v'], 'u')).toEqual(['v']);
    });
});

describe('applyTranslationDraft', () => {
    const form: Partial<PlaceData> = {
        name: 'X', nameEs: 'Viejo', whyThisPlaceEs: 'mantener', bestForEs: ['a'],
    };

    it('sobrescribe solo los campos que el borrador trae', () => {
        const draft = {
            nameEs: 'Nuevo', whyThisPlaceEs: null, bestTimeEs: 'tarde',
            neighborhoodEs: null, subcategoriesEs: null, subcategoryEs: null,
            bestForEs: null, suitableForEs: null,
        } as PlaceTranslateDraft;
        const next = applyTranslationDraft(form, draft);
        expect(next.nameEs).toBe('Nuevo');         // draft gana
        expect(next.whyThisPlaceEs).toBe('mantener'); // null no pisa
        expect(next.bestTimeEs).toBe('tarde');
        expect(next.bestForEs).toEqual(['a']);     // null no pisa
        expect(next.name).toBe('X');               // campos no-ES intactos
    });
});

describe('savePlace (orquestación + camino de error)', () => {
    const placeOut = { id: 'p1', name: 'Saved' } as PlaceData;

    it('sin cambios: no llama a la API', async () => {
        const apiCall = vi.fn(async () => ({ data: placeOut, error: null }));
        const out = await savePlace(apiCall, 'p1', {});
        expect(out).toEqual({ status: 'no-changes' });
        expect(apiCall).not.toHaveBeenCalled();
    });

    it('con cambios: PATCH y devuelve el place canónico', async () => {
        const apiCall = vi.fn(async () => ({ data: placeOut, error: null }));
        const out = await savePlace(apiCall, 'p1', { name: 'Saved' });
        expect(out).toEqual({ status: 'saved', data: placeOut });
        expect(apiCall).toHaveBeenCalledWith('/admin/places/p1', { method: 'PATCH', body: { name: 'Saved' } });
    });

    it('error de API: status error con el mensaje', async () => {
        const apiCall = vi.fn(async () => ({ data: null, error: 'boom' }));
        const out = await savePlace(apiCall, 'p1', { name: 'X' });
        expect(out).toEqual({ status: 'error', message: 'boom' });
    });

    it('sin data ni error: mensaje por defecto', async () => {
        const apiCall: SavePlaceApi = vi.fn(async () => ({ data: null, error: null }));
        const out = await savePlace(apiCall, 'p1', { name: 'X' });
        expect(out).toEqual({ status: 'error', message: 'unknown error' });
    });
});
