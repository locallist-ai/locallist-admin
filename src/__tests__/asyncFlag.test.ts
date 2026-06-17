import { describe, expect, it } from 'vitest';
import { withFlag } from '../lib/asyncFlag';

/**
 * Máquina de estados del actionLoading que envuelve las mutaciones del
 * dashboard (approve / postpone / changeStatus / reject / delete):
 * true durante el vuelo → false al terminar, también en error.
 */
describe('withFlag', () => {
    it('flag en true durante el vuelo y false tras el éxito', async () => {
        const transitions: boolean[] = [];
        let resolve!: (v: string) => void;

        const result = withFlag(
            (v) => transitions.push(v),
            () => new Promise<string>((r) => { resolve = r; }),
        );

        expect(transitions).toEqual([true]); // en vuelo

        resolve('ok');
        await expect(result).resolves.toBe('ok');
        expect(transitions).toEqual([true, false]);
    });

    it('flag baja también cuando la acción rechaza (la UI nunca queda colgada)', async () => {
        const transitions: boolean[] = [];

        await expect(
            withFlag((v) => transitions.push(v), () => Promise.reject(new Error('network'))),
        ).rejects.toThrow('network');

        expect(transitions).toEqual([true, false]);
    });

    it('el valor error-as-value del api pasa intacto (res.error no es throw)', async () => {
        const transitions: boolean[] = [];
        const res = await withFlag(
            (v) => transitions.push(v),
            async () => ({ data: null, error: 'Failed to update' }),
        );

        expect(res.error).toBe('Failed to update');
        expect(transitions).toEqual([true, false]);
    });
});
