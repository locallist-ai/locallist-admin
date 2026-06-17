/**
 * Tests de la lógica pura del editor de planes (`src/lib/planForm.ts`):
 * mapeo plan→form/stops, diff de metadata, operaciones locales de stops
 * (alta con tope por día, baja + reindex, mover + reindex) y la orquestación
 * del save con la API inyectada, incluido su camino de error.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    addStop,
    metadataDirty,
    moveStop,
    planToForm,
    planToStops,
    removeStop,
    savePlan,
    serializeStops,
    stopsToPayload,
    type LocalStop,
    type PlanForm,
} from '../lib/planForm';
import type { PlanData } from '../types/plan';

const baseForm: PlanForm = {
    name: 'Trip', city: 'Madrid', type: 'foodie', description: 'd', imageUrl: '',
    durationDays: 2, isPublic: true, isShowcase: false,
    nameEs: null, descriptionEs: null, translationStatusEs: null,
};

const stop = (placeId: string, dayNumber: number, orderIndex: number): LocalStop => ({
    placeId, placeName: `P-${placeId}`, placeCategory: 'food', dayNumber, orderIndex,
});

describe('planToForm / planToStops', () => {
    it('mapea el plan a form con defaults para campos opcionales', () => {
        const plan = {
            name: 'X', city: 'BCN', type: 'culture', durationDays: 1,
            isPublic: false, isShowcase: true,
        } as PlanData;
        expect(planToForm(plan)).toEqual({
            name: 'X', city: 'BCN', type: 'culture', description: '', imageUrl: '',
            durationDays: 1, isPublic: false, isShowcase: true,
            nameEs: null, descriptionEs: null, translationStatusEs: null,
        });
    });

    it('aplana days→stops preservando orderIndex y metadata', () => {
        const plan = {
            days: [
                { dayNumber: 1, stops: [{ orderIndex: 0, timeBlock: 'lunch', suggestedDurationMin: 45, place: { id: 'a', name: 'A', category: 'food' } }] },
                { dayNumber: 2, stops: [{ orderIndex: 0, place: { id: 'b', name: 'B', category: 'bar' } }] },
            ],
        } as unknown as PlanData;
        expect(planToStops(plan)).toEqual([
            { placeId: 'a', placeName: 'A', placeCategory: 'food', dayNumber: 1, orderIndex: 0, timeBlock: 'lunch', suggestedDurationMin: 45 },
            { placeId: 'b', placeName: 'B', placeCategory: 'bar', dayNumber: 2, orderIndex: 0, timeBlock: undefined, suggestedDurationMin: undefined },
        ]);
    });

    it('plan sin days devuelve lista vacía', () => {
        expect(planToStops({} as PlanData)).toEqual([]);
    });
});

describe('metadataDirty', () => {
    it('sin cambios: objeto vacío', () => {
        expect(metadataDirty(baseForm, baseForm)).toEqual({});
    });

    it('solo devuelve las claves modificadas', () => {
        const next = { ...baseForm, name: 'New', isPublic: false };
        expect(metadataDirty(next, baseForm)).toEqual({ name: 'New', isPublic: false });
    });
});

describe('addStop (tope por día)', () => {
    it('añade en el siguiente orderIndex de su día', () => {
        const stops = [stop('a', 1, 0)];
        const res = addStop(stops, { placeId: 'b', placeName: 'B', placeCategory: 'bar', dayNumber: 1, timeBlock: 'dinner', durationMin: 30 }, 5);
        expect(res.added).toBe(true);
        expect(res.stops).toHaveLength(2);
        expect(res.stops[1]).toMatchObject({ placeId: 'b', dayNumber: 1, orderIndex: 1, timeBlock: 'dinner', suggestedDurationMin: 30 });
    });

    it('cuenta por día: día distinto empieza en 0', () => {
        const res = addStop([stop('a', 1, 0)], { placeId: 'b', placeName: 'B', placeCategory: 'bar', dayNumber: 2 }, 5);
        expect(res.stops[1].orderIndex).toBe(0);
    });

    it('bloquea cuando el día está lleno y no muta la lista', () => {
        const stops = [stop('a', 1, 0), stop('b', 1, 1)];
        const res = addStop(stops, { placeId: 'c', placeName: 'C', placeCategory: 'food', dayNumber: 1 }, 2);
        expect(res.added).toBe(false);
        expect(res.stops).toBe(stops);
    });
});

describe('removeStop (reindex)', () => {
    it('quita el stop y renumera el resto del día a 0..n-1', () => {
        const stops = [stop('a', 1, 0), stop('b', 1, 1), stop('c', 1, 2)];
        const next = removeStop(stops, 1, 1);
        expect(next.map((s) => [s.placeId, s.orderIndex])).toEqual([['a', 0], ['c', 1]]);
    });

    it('no toca los stops de otros días', () => {
        const stops = [stop('a', 1, 0), stop('x', 2, 0), stop('y', 2, 1)];
        const next = removeStop(stops, 1, 0);
        const day2 = next.filter((s) => s.dayNumber === 2);
        expect(day2.map((s) => [s.placeId, s.orderIndex])).toEqual([['x', 0], ['y', 1]]);
    });
});

describe('moveStop (reindex)', () => {
    const stops = [stop('a', 1, 0), stop('b', 1, 1), stop('c', 1, 2)];

    it('sube un stop intercambiándolo con el anterior', () => {
        const next = moveStop(stops, 1, 1, -1).sort((a, b) => a.orderIndex - b.orderIndex);
        expect(next.map((s) => s.placeId)).toEqual(['b', 'a', 'c']);
        expect(next.map((s) => s.orderIndex)).toEqual([0, 1, 2]);
    });

    it('baja un stop intercambiándolo con el siguiente', () => {
        const next = moveStop(stops, 1, 1, 1).sort((a, b) => a.orderIndex - b.orderIndex);
        expect(next.map((s) => s.placeId)).toEqual(['a', 'c', 'b']);
    });

    it('no-op en los bordes (devuelve la misma referencia)', () => {
        expect(moveStop(stops, 1, 0, -1)).toBe(stops);
        expect(moveStop(stops, 1, 2, 1)).toBe(stops);
    });
});

describe('stopsToPayload', () => {
    it('proyecta solo los campos del payload del backend', () => {
        const s: LocalStop = { placeId: 'a', placeName: 'A', placeCategory: 'food', dayNumber: 1, orderIndex: 0, timeBlock: 'lunch', suggestedDurationMin: 20 };
        expect(stopsToPayload([s])).toEqual([{ placeId: 'a', dayNumber: 1, orderIndex: 0, timeBlock: 'lunch', suggestedDurationMin: 20 }]);
    });
});

describe('savePlan (orquestación + camino de error)', () => {
    it('sin cambios: no llama a la API', async () => {
        const apiCall = vi.fn(async () => ({ error: null }));
        const out = await savePlan(apiCall, 'p1', { metaDirty: {}, stops: [], stopsChanged: false });
        expect(out).toEqual({ status: 'no-changes' });
        expect(apiCall).not.toHaveBeenCalled();
    });

    it('solo metadata: un PATCH y saved', async () => {
        const apiCall = vi.fn(async () => ({ error: null }));
        const out = await savePlan(apiCall, 'p1', { metaDirty: { name: 'New' }, stops: [], stopsChanged: false });
        expect(out).toEqual({ status: 'saved' });
        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(apiCall).toHaveBeenCalledWith('/admin/plans/p1', { method: 'PATCH', body: { name: 'New' } });
    });

    it('solo stops: un PATCH atómico con los stops en el body', async () => {
        const apiCall = vi.fn(async () => ({ error: null }));
        const stops = [stop('a', 1, 0)];
        const out = await savePlan(apiCall, 'p1', { metaDirty: {}, stops, stopsChanged: true });
        expect(out).toEqual({ status: 'saved' });
        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(apiCall).toHaveBeenCalledWith('/admin/plans/p1', {
            method: 'PATCH',
            body: { stops: stopsToPayload(stops) },
        });
    });

    it('metadata + stops: un solo PATCH atómico con ambos en el body', async () => {
        const apiCall = vi.fn(async () => ({ error: null }));
        const stops = [stop('a', 1, 0)];
        const out = await savePlan(apiCall, 'p1', { metaDirty: { name: 'N' }, stops, stopsChanged: true });
        expect(out).toEqual({ status: 'saved' });
        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(apiCall).toHaveBeenCalledWith('/admin/plans/p1', {
            method: 'PATCH',
            body: { name: 'N', stops: stopsToPayload(stops) },
        });
    });

    it('error: una sola llamada atómica, sin estado mixto', async () => {
        const apiCall = vi.fn(async () => ({ error: 'boom' }));
        const out = await savePlan(apiCall, 'p1', { metaDirty: { name: 'N' }, stops: [stop('a', 1, 0)], stopsChanged: true });
        expect(out).toEqual({ status: 'error', message: 'boom' });
        expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it('serializeStops detecta cambios de orden', () => {
        expect(serializeStops([stop('a', 1, 0)]) === serializeStops([stop('a', 1, 0)])).toBe(true);
        expect(serializeStops([stop('a', 1, 0)]) === serializeStops([stop('a', 1, 1)])).toBe(false);
    });
});
