import { auth } from './firebase';

function getApiUrl(): string {
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (url) return url;
    throw new Error(
        '[api] EXPO_PUBLIC_API_URL is not set. Add it to your .env file.\n' +
        'Example: EXPO_PUBLIC_API_URL=http://localhost:5000',
    );
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
    options: { method?: string; body?: any; headers?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
    const { method = 'GET', body, headers = {}, timeoutMs = TIMEOUT_MS, signal: externalSignal } = options;

    // Get fresh Firebase JWT (auto-refreshed by Firebase SDK — no manual refresh needed here)
    const token = await auth.currentUser?.getIdToken();

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
    };

    if (token) requestHeaders['Authorization'] = `Bearer ${token}`;

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
        if (externalSignal?.aborted) return { data: null, error: 'cancelled', errorBody: null, status: 0 };
        const controller = new AbortController();
        externalSignal?.addEventListener('abort', () => controller.abort());
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
