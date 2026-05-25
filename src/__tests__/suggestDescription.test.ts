import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase so api.ts doesn't crash without a real Firebase app
vi.mock('../lib/firebase', () => ({
    getFirebaseAuth: () => ({ currentUser: null }),
}));

process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';

// Test the suggest-description API contract: POST /admin/places/{id}/suggest-description
// Exercises the api client path (not the React component — vitest has no JSX/RN support here).

const FAKE_PLACE_ID = '00000000-0000-0000-0000-000000000001';

function mockFetch(status: number, body: unknown) {
    return vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    );
}

describe('suggest-description API contract', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('calls POST /admin/places/{id}/suggest-description and returns whyThisPlace', async () => {
        const expectedText = 'Sun-drenched terrace with specialty single-origin brews.';
        vi.stubGlobal('fetch', mockFetch(200, { whyThisPlace: expectedText }));

        const { api } = await import('../lib/api');
        const res = await api<{ whyThisPlace: string }>(
            `/admin/places/${FAKE_PLACE_ID}/suggest-description`,
            { method: 'POST' },
        );

        const fetchMock = (globalThis.fetch as ReturnType<typeof vi.fn>);
        const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain(`/admin/places/${FAKE_PLACE_ID}/suggest-description`);
        expect(res.data?.whyThisPlace).toBe(expectedText);
    });

    it('surfaces error when service returns 503', async () => {
        vi.stubGlobal('fetch', mockFetch(503, { error: 'Description generation service unavailable.' }));

        const { api } = await import('../lib/api');
        const res = await api<{ whyThisPlace: string }>(
            `/admin/places/${FAKE_PLACE_ID}/suggest-description`,
            { method: 'POST' },
        );

        expect(res.data).toBeNull();
        expect(res.error).toBeTruthy();
    });
});
