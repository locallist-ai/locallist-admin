import { describe, expect, it } from 'vitest';
import { shouldApplyResponse, staleResetsLoadingMore } from '../lib/raceGuard';

describe('shouldApplyResponse', () => {
    it('aplica la respuesta cuando sigue siendo la más reciente', () => {
        let counter = 0;
        const reqId = ++counter;
        expect(shouldApplyResponse(reqId, counter)).toBe(true);
    });

    it('descarta la respuesta de un request supersedido (interleaving real)', () => {
        let counter = 0;
        const req1 = ++counter; // primera petición en vuelo
        const req2 = ++counter; // la segunda la supersede
        // Llega la respuesta de la primera: NO debe pisar a la ganadora.
        expect(shouldApplyResponse(req1, counter)).toBe(false);
        // Llega la de la segunda: sí se aplica.
        expect(shouldApplyResponse(req2, counter)).toBe(true);
    });

    it('en orden secuencial cada respuesta se aplica', () => {
        let counter = 0;
        const req1 = ++counter;
        expect(shouldApplyResponse(req1, counter)).toBe(true);
        const req2 = ++counter;
        expect(shouldApplyResponse(req2, counter)).toBe(true);
    });
});

describe('staleResetsLoadingMore', () => {
    it('un initial stale NO toca flags: el ganador en vuelo limpiará loading', () => {
        expect(staleResetsLoadingMore(true)).toBe(false);
    });

    it('un load-more stale SÍ limpia loadingMore: nadie más lo hará', () => {
        expect(staleResetsLoadingMore(false)).toBe(true);
    });
});

/**
 * Simulación del protocolo completo del hook (sin renderizar React):
 * reproduce el interleaving que causaba el bug del spinner. Con la
 * semántica antigua (un stale inicial hacía setLoading(false)) el primer
 * assert de `loading === true` FALLA.
 */
describe('protocolo del guard — interleaving initial-vs-initial (regresión del spinner)', () => {
    type Flags = { loading: boolean; loadingMore: boolean };

    function makeLoader(flags: Flags) {
        let counter = 0;
        return async (isInitial: boolean, response: Promise<void>) => {
            if (isInitial) flags.loading = true;
            else flags.loadingMore = true;

            const reqId = ++counter;
            await response;

            if (!shouldApplyResponse(reqId, counter)) {
                if (staleResetsLoadingMore(isInitial)) flags.loadingMore = false;
                return;
            }
            if (isInitial) flags.loading = false;
            else flags.loadingMore = false;
        };
    }

    it('la respuesta stale no apaga el spinner del ganador en vuelo (StrictMode double-fire)', async () => {
        const flags: Flags = { loading: false, loadingMore: false };
        const load = makeLoader(flags);

        let resolveA!: () => void;
        let resolveB!: () => void;
        const runA = load(true, new Promise<void>((r) => { resolveA = r; }));
        const runB = load(true, new Promise<void>((r) => { resolveB = r; }));

        // A (stale) resuelve primero; B (ganadora) sigue en vuelo.
        resolveA();
        await runA;
        expect(flags.loading).toBe(true); // el spinner del ganador sigue visible

        resolveB();
        await runB;
        expect(flags.loading).toBe(false); // el ganador lo limpia al terminar
    });

    it('un load-more supersedido por un initial limpia loadingMore (no bloquea canLoadMore)', async () => {
        const flags: Flags = { loading: false, loadingMore: false };
        const load = makeLoader(flags);

        let resolveMore!: () => void;
        let resolveInitial!: () => void;
        const runMore = load(false, new Promise<void>((r) => { resolveMore = r; }));
        const runInitial = load(true, new Promise<void>((r) => { resolveInitial = r; }));

        resolveMore();
        await runMore;
        expect(flags.loadingMore).toBe(false); // se limpió a sí mismo

        resolveInitial();
        await runInitial;
        expect(flags.loading).toBe(false);
    });
});
