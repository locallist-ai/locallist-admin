import { auth } from './firebase';

function getApiUrl(): string {
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
    return 'https://locallist-api-net-production.up.railway.app';
}

const API_URL = getApiUrl();

// ─── API client ──────────────────────────────────────────

interface ApiResult<T> {
    data: T | null;
    error: string | null;
    errorBody: any;
    status: number;
}

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

export async function api<T>(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
    const { method = 'GET', body, headers = {} } = options;

    // Get fresh Firebase JWT (auto-refreshed by Firebase SDK — no manual refresh needed here)
    const token = await auth.currentUser?.getIdToken();

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
    };

    if (token) requestHeaders['Authorization'] = `Bearer ${token}`;

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(`${API_URL}${path}`, {
                method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const json = await res.json().catch(() => null);

            if (!res.ok) {
                if (res.status >= 500 && attempt < MAX_RETRIES) {
                    attempt++;
                    continue;
                }
                return {
                    data: null,
                    error: json?.error ?? `HTTP ${res.status}`,
                    errorBody: json,
                    status: res.status,
                };
            }

            return { data: json as T, error: null, errorBody: null, status: res.status };
        } catch (err: unknown) {
            clearTimeout(timeout);
            const message = err instanceof Error ? err.message : 'Network error';
            return { data: null, error: message, errorBody: null, status: 0 };
        }
    }

    return { data: null, error: 'Max retries exceeded', errorBody: null, status: 0 };
}
