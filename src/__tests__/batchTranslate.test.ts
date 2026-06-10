/**
 * Tests del loop de traducción por lotes (`src/lib/batchTranslate.ts`).
 * La llamada a la API se inyecta, así que el loop completo (acumulación,
 * total fijado en el primer chunk, tolerancia a errores, cancelación)
 * se prueba en vitest sin tocar módulos nativos.
 */
import { describe, it, expect, vi } from 'vitest';
import { runBatchTranslate, type BatchChunkResponse } from '../lib/batchTranslate';

const chunk = (translated: number, failed: number, skipped: number, remaining: number): BatchChunkResponse => ({
    data: { translated, failed, skipped, remaining },
    error: null,
});

const errChunk = (message: string): BatchChunkResponse => ({ data: null, error: message });

describe('runBatchTranslate', () => {
    it('un solo chunk con remaining 0 termina y reporta el total', async () => {
        const onProgress = vi.fn();
        const result = await runBatchTranslate(async () => chunk(5, 1, 2, 0), new AbortController().signal, onProgress);

        expect(result).toEqual({ translated: 5, failed: 1, aborted: false, error: null });
        expect(onProgress).toHaveBeenCalledTimes(1);
        // total = translated + failed + skipped + remaining del primer chunk
        expect(onProgress).toHaveBeenCalledWith({ current: 5, total: 8 });
    });

    it('acumula varios chunks y fija el denominador con el primero', async () => {
        const chunks = [chunk(5, 0, 0, 10), chunk(5, 0, 0, 5), chunk(5, 0, 0, 0)];
        let i = 0;
        const onProgress = vi.fn();

        const result = await runBatchTranslate(async () => chunks[i++], new AbortController().signal, onProgress);

        expect(result.translated).toBe(15);
        expect(onProgress).toHaveBeenLastCalledWith({ current: 15, total: 15 });
        // El total no se recalcula chunk a chunk: queda fijado en 15.
        expect(onProgress.mock.calls.every(([p]) => p.total === 15)).toBe(true);
    });

    it('se rinde tras 3 errores consecutivos con el último mensaje', async () => {
        const fetchChunk = vi.fn(async () => errChunk('boom'));
        const onProgress = vi.fn();

        const result = await runBatchTranslate(fetchChunk, new AbortController().signal, onProgress);

        expect(fetchChunk).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ translated: 0, failed: 0, aborted: false, error: 'boom' });
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('un chunk bueno resetea el contador de errores consecutivos', async () => {
        const seq = [errChunk('x'), errChunk('x'), chunk(1, 0, 0, 1), errChunk('x'), errChunk('x'), chunk(1, 0, 0, 0)];
        let i = 0;
        const fetchChunk = vi.fn(async () => seq[i++]);

        const result = await runBatchTranslate(fetchChunk, new AbortController().signal, vi.fn());

        // Sin reset, el tercer error (índice 3) cortaría el loop en 4 llamadas.
        expect(fetchChunk).toHaveBeenCalledTimes(6);
        expect(result).toEqual({ translated: 2, failed: 0, aborted: false, error: null });
    });

    it('abortar durante un chunk descarta su resultado y marca aborted', async () => {
        const controller = new AbortController();
        const fetchChunk = vi.fn(async () => {
            controller.abort();
            return chunk(5, 0, 0, 10);
        });

        const result = await runBatchTranslate(fetchChunk, controller.signal, vi.fn());

        expect(fetchChunk).toHaveBeenCalledTimes(1);
        // El chunk llegó después de cancelar: sus números no cuentan.
        expect(result).toEqual({ translated: 0, failed: 0, aborted: true, error: null });
    });

    it('señal ya abortada: no llama a la API ni una vez', async () => {
        const controller = new AbortController();
        controller.abort();
        const fetchChunk = vi.fn(async () => chunk(1, 0, 0, 0));

        const result = await runBatchTranslate(fetchChunk, controller.signal, vi.fn());

        expect(fetchChunk).not.toHaveBeenCalled();
        expect(result.aborted).toBe(true);
    });
});
