import { getFirebaseAuth } from './firebase';

let cachedApiUrl: string | undefined;

function getApiUrl(): string {
    if (cachedApiUrl) return cachedApiUrl;
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (!url) {
        throw new Error(
            '[api] EXPO_PUBLIC_API_URL is not set. Add it to your .env file.\n' +
            'Example: EXPO_PUBLIC_API_URL=http://localhost:5000',
        );
    }
    cachedApiUrl = url;
    return cachedApiUrl;
}

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

    const apiUrl = getApiUrl();
    const token = await getFirebaseAuth().currentUser?.getIdToken();

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
    };

    if (token) requestHeaders['Authorization'] = `Bearer ${token}`;

    // One controller per call (not per retry attempt) so the external signal
    // gets exactly one listener, removed in the finally below. An already-aborted
    // signal never fires 'abort', so propagate that state explicitly.
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    if (externalSignal?.aborted) {
        controller.abort();
    } else {
        externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
        let attempt = 0;
        while (attempt <= MAX_RETRIES) {
            if (controller.signal.aborted) return { data: null, error: 'cancelled', errorBody: null, status: 0 };
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(`${apiUrl}${path}`, {
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
    } finally {
        externalSignal?.removeEventListener('abort', onExternalAbort);
    }
}
