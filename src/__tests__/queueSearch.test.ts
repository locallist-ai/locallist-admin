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

describe('queue search — API contract', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('passes search param in the URL when querying places', async () => {
        vi.stubGlobal('fetch', mockFetch(200, { places: [], total: 0 }));

        const { api } = await import('../lib/api');
        await api('/admin/places?status=in_review&search=ramen');

        const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
        const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('search=ramen');
        expect(url).toContain('status=in_review');
    });

    it('returns empty list when search matches nothing', async () => {
        vi.stubGlobal('fetch', mockFetch(200, { places: [], total: 0 }));

        const { api } = await import('../lib/api');
        const res = await api<{ places: unknown[]; total: number }>(
            '/admin/places?status=in_review&search=xyznotfound',
        );

        expect(res.data?.total).toBe(0);
        expect(res.data?.places).toHaveLength(0);
    });
});
