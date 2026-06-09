import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/firebase', () => ({
    getFirebaseAuth: () => ({ currentUser: null }),
}));

process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';

function mockFetch(status: number, body: unknown) {
    return vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    );
}

describe('api — abort signal handling', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns cancelled without fetching when the signal is already aborted', async () => {
        const fetchMock = mockFetch(200, {});
        vi.stubGlobal('fetch', fetchMock);

        const controller = new AbortController();
        controller.abort();

        const { api } = await import('../lib/api');
        const res = await api('/admin/places', { signal: controller.signal });

        expect(res.error).toBe('cancelled');
        expect(res.status).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('removes its abort listener from the external signal after the call', async () => {
        vi.stubGlobal('fetch', mockFetch(200, { ok: true }));

        const controller = new AbortController();
        const addSpy = vi.spyOn(controller.signal, 'addEventListener');
        const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

        const { api } = await import('../lib/api');
        await api('/admin/places', { signal: controller.signal });

        expect(addSpy).toHaveBeenCalledTimes(1);
        const [addEvent, addedListener] = addSpy.mock.calls[0];
        expect(addEvent).toBe('abort');
        expect(removeSpy).toHaveBeenCalledWith('abort', addedListener);
    });

    it('attaches a single listener even when 5xx responses trigger a retry', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: 'boom' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const controller = new AbortController();
        const addSpy = vi.spyOn(controller.signal, 'addEventListener');

        const { api } = await import('../lib/api');
        const res = await api('/admin/places', { signal: controller.signal });

        expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(500);
    });

    it('aborting the external signal mid-flight cancels the request', async () => {
        const controller = new AbortController();
        vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () =>
                    reject(new DOMException('The operation was aborted.', 'AbortError')),
                );
            }),
        ));

        const { api } = await import('../lib/api');
        const pending = api('/admin/places', { signal: controller.signal });
        controller.abort();
        const res = await pending;

        expect(res.data).toBeNull();
        expect(res.status).toBe(0);
    });
});
