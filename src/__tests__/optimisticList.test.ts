/**
 * Tests de las operaciones puras de listas (`src/lib/optimisticList.ts`)
 * que sostienen los optimistic updates del dashboard: quitar antes de que
 * la API confirme y restaurar en su posición si la llamada falla.
 */
import { describe, it, expect } from 'vitest';
import { moveToFront, removeById, restoreAt, shiftCount } from '../lib/optimisticList';

const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('removeById', () => {
    it('quita el elemento y devuelve su posición original', () => {
        const { next, removed, index } = removeById(list, 'b');
        expect(next).toEqual([{ id: 'a' }, { id: 'c' }]);
        expect(removed).toEqual({ id: 'b' });
        expect(index).toBe(1);
    });

    it('id inexistente: lista intacta y removed null', () => {
        const { next, removed, index } = removeById(list, 'zzz');
        expect(next).toBe(list);
        expect(removed).toBeNull();
        expect(index).toBe(-1);
    });

    it('no muta la lista de entrada', () => {
        removeById(list, 'a');
        expect(list).toHaveLength(3);
    });
});

describe('restoreAt (rollback)', () => {
    it('restaura el elemento en su posición original', () => {
        expect(restoreAt([{ id: 'a' }, { id: 'c' }], { id: 'b' }, 1))
            .toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    });

    it('clampa el índice si la lista encogió mientras tanto', () => {
        expect(restoreAt([{ id: 'a' }], { id: 'z' }, 5))
            .toEqual([{ id: 'a' }, { id: 'z' }]);
    });

    it('no muta la lista de entrada', () => {
        const input = [{ id: 'a' }];
        restoreAt(input, { id: 'b' }, 0);
        expect(input).toEqual([{ id: 'a' }]);
    });
});

describe('moveToFront (postpone)', () => {
    it('mueve el elemento al frente conservando el resto en orden', () => {
        expect(moveToFront(list, 'c')).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    });

    it('id inexistente devuelve la misma lista', () => {
        expect(moveToFront(list, 'zzz')).toBe(list);
    });
});

describe('shiftCount (badges)', () => {
    const counts = { in_review: 2, published: 5, rejected: 0 };

    it('mueve una unidad entre buckets', () => {
        expect(shiftCount(counts, 'in_review', 'published'))
            .toEqual({ in_review: 1, published: 6, rejected: 0 });
    });

    it('nunca baja de cero', () => {
        expect(shiftCount(counts, 'rejected', null))
            .toEqual({ in_review: 2, published: 5, rejected: 0 });
    });

    it('from null solo incrementa; to null solo decrementa', () => {
        expect(shiftCount(counts, null, 'rejected').rejected).toBe(1);
        expect(shiftCount(counts, 'published', null).published).toBe(4);
    });

    it('no muta el objeto de entrada', () => {
        shiftCount(counts, 'in_review', 'published');
        expect(counts).toEqual({ in_review: 2, published: 5, rejected: 0 });
    });
});
