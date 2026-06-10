/**
 * Driver for the chunked batch-translate loop. The endpoint translates a
 * small chunk per call and reports how much remains; this loop keeps
 * calling until done, tolerating up to N consecutive failed chunks.
 *
 * The API call is injected so the loop is unit-testable in vitest.
 */

export interface BatchChunk {
    translated: number;
    failed: number;
    skipped: number;
    remaining: number;
}

export interface BatchChunkResponse {
    data: BatchChunk | null;
    error: string | null;
}

export interface BatchProgress {
    current: number;
    total: number;
}

export interface BatchTranslateResult {
    translated: number;
    failed: number;
    aborted: boolean;
    /** Set when the loop gave up after consecutive chunk failures. */
    error: string | null;
}

const MAX_CONSECUTIVE_ERRORS = 3;

export async function runBatchTranslate(
    fetchChunk: () => Promise<BatchChunkResponse>,
    signal: AbortSignal,
    onProgress: (progress: BatchProgress) => void,
): Promise<BatchTranslateResult> {
    let translated = 0;
    let failed = 0;
    let total: number | null = null;
    let consecutiveErrors = 0;

    while (!signal.aborted) {
        const res = await fetchChunk();
        // A chunk that lands after the user cancelled is discarded.
        if (signal.aborted) break;

        if (!res.data) {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                return { translated, failed, aborted: false, error: res.error ?? 'unknown error' };
            }
            continue;
        }

        consecutiveErrors = 0;
        translated += res.data.translated;
        failed += res.data.failed;

        // The first successful chunk fixes the denominator: everything the
        // backend reported as done, skipped or still pending at that moment.
        if (total === null) {
            total = translated + failed + res.data.skipped + res.data.remaining;
        }

        onProgress({ current: translated, total: total ?? translated });

        if (res.data.remaining === 0) break;
    }

    return { translated, failed, aborted: signal.aborted, error: null };
}
