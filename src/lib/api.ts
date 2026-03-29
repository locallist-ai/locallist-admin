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

export async function api<T>(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
    const { method = 'GET', body, headers = {} } = options;

    // Get fresh Firebase JWT (auto-refreshed by Firebase SDK)
    const token = await auth.currentUser?.getIdToken();

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
    };

    if (token) requestHeaders['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_URL}${path}`, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
            return {
                data: null,
                error: json?.error ?? `HTTP ${res.status}`,
                errorBody: json,
                status: res.status,
            };
        }

        return { data: json as T, error: null, errorBody: null, status: res.status };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network error';
        return { data: null, error: message, errorBody: null, status: 0 };
    }
}
