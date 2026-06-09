/**
 * Tests de `src/lib/subcategories.ts` — creación de subcategorías (single y
 * batch) contra POST /admin/subcategories, con fetch mockeado igual que en
 * apiAbort.test.ts. Cubre el throw con el mensaje del servidor, el fallback
 * cuando el error llega vacío, y que un fallo parcial del batch nunca pierde
 * las filas que sí se crearon.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/firebase', () => ({
    getFirebaseAuth: () => ({ currentUser: null }),
}));

process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';

const item = (key: string) => ({
    id: `id-${key}`,
    categoryKey: 'Nightlife',
    key,
    labelEn: key,
    labelEs: key,
    createdAt: '2026-06-09T00:00:00Z',
    updatedAt: '2026-06-09T00:00:00Z',
});

const payload = (key: string) => ({
    categoryKey: 'Nightlife',
    key,
    labelEn: key,
    labelEs: key,
});

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('postSubcategory', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('devuelve la subcategoría creada', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(201, item('rooftop-bar'))));

        const { postSubcategory } = await import('../lib/subcategories');
        const created = await postSubcategory(payload('rooftop-bar'));

        expect(created.key).toBe('rooftop-bar');
    });

    it('lanza con el mensaje de error del servidor (p. ej. duplicado 409)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            jsonResponse(409, { error: "Subcategory 'pub' already exists for category 'Nightlife'.", code: 'duplicate_subcategory' }),
        ));

        const { postSubcategory } = await import('../lib/subcategories');
        await expect(postSubcategory(payload('pub'))).rejects.toThrow(
            "Subcategory 'pub' already exists for category 'Nightlife'.",
        );
    });

    it('error vacío ("") del servidor -> fallback con el status HTTP, nunca mensaje en blanco', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, { error: '' })));

        const { postSubcategory } = await import('../lib/subcategories');
        await expect(postSubcategory(payload('pub'))).rejects.toThrow('HTTP 409');
    });
});

describe('postSubcategoriesBatch', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('crea todas las filas en orden y no reporta fallos', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse(201, item('speakeasy')))
            .mockResolvedValueOnce(jsonResponse(201, item('wine-bar')));
        vi.stubGlobal('fetch', fetchMock);

        const { postSubcategoriesBatch } = await import('../lib/subcategories');
        const result = await postSubcategoriesBatch([payload('speakeasy'), payload('wine-bar')]);

        expect(result.created.map((c) => c.key)).toEqual(['speakeasy', 'wine-bar']);
        expect(result.failures).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).key).toBe('speakeasy');
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).key).toBe('wine-bar');
    });

    it('un fallo a mitad de batch no bloquea el resto: éxitos y fallos se reportan juntos', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse(201, item('speakeasy')))
            .mockResolvedValueOnce(jsonResponse(409, { error: 'duplicate', code: 'duplicate_subcategory' }))
            .mockResolvedValueOnce(jsonResponse(201, item('wine-bar')));
        vi.stubGlobal('fetch', fetchMock);

        const { postSubcategoriesBatch } = await import('../lib/subcategories');
        const result = await postSubcategoriesBatch([
            payload('speakeasy'), payload('pub'), payload('wine-bar'),
        ]);

        expect(result.created.map((c) => c.key)).toEqual(['speakeasy', 'wine-bar']);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].payload.key).toBe('pub');
        expect(result.failures[0].message).toBe('duplicate');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('batch vacío -> no llama a la API', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { postSubcategoriesBatch } = await import('../lib/subcategories');
        const result = await postSubcategoriesBatch([]);

        expect(result).toEqual({ created: [], failures: [] });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
