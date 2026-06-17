/**
 * Pure logic behind the monotonic request-id race guard used by the
 * dashboard data hooks (usePlacesData / usePlansData).
 *
 * Protocol: each fetch bumps a shared counter and remembers its own id
 * (`reqId`). When the response lands, it is only applied if no newer
 * request was issued meanwhile.
 */

/** True when the response belongs to the most recent request. */
export function shouldApplyResponse(reqId: number, currentId: number): boolean {
    return reqId === currentId;
}

/**
 * Whether a superseded (stale) request must clear `loadingMore` itself.
 *
 * - A stale INITIAL load must NOT touch `loading`: the winning request is
 *   still in flight and will clear it when it finishes — clearing it here
 *   hides the winner's spinner early (reproducible under StrictMode's
 *   double effect-fire on mount).
 * - A stale LOAD-MORE must clear `loadingMore`: a newer initial load never
 *   resets it, and a stuck `loadingMore` blocks canLoadMore forever.
 */
export function staleResetsLoadingMore(isInitial: boolean): boolean {
    return !isInitial;
}
