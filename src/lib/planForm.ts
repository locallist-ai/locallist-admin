/**
 * Pure logic behind the plan edit screen (`usePlanForm`): metadata diffing,
 * the local stop operations (add with per-day cap, remove + re-index, move +
 * re-index) and the save orchestration. The API call is injected so the save
 * decision and its error paths are unit-testable in vitest without RN.
 */
import type { PlanData } from '../types/plan';

export interface PlanForm {
    name: string;
    city: string;
    type: string;
    description: string;
    imageUrl: string;
    durationDays: number;
    isPublic: boolean;
    isShowcase: boolean;
    nameEs: string | null;
    descriptionEs: string | null;
    translationStatusEs: string | null;
}

export interface LocalStop {
    placeId: string;
    placeName: string;
    placeCategory: string;
    dayNumber: number;
    orderIndex: number;
    timeBlock?: string;
    suggestedDurationMin?: number;
}

export function planToForm(plan: PlanData): PlanForm {
    return {
        name: plan.name,
        city: plan.city,
        type: plan.type,
        description: plan.description ?? '',
        imageUrl: plan.imageUrl ?? '',
        durationDays: plan.durationDays,
        isPublic: plan.isPublic,
        isShowcase: plan.isShowcase,
        nameEs: plan.nameEs ?? null,
        descriptionEs: plan.descriptionEs ?? null,
        translationStatusEs: plan.translationStatusEs ?? null,
    };
}

export function planToStops(plan: PlanData): LocalStop[] {
    return (plan.days ?? []).flatMap((day) =>
        day.stops.map((s) => ({
            placeId: s.place.id,
            placeName: s.place.name,
            placeCategory: s.place.category,
            dayNumber: day.dayNumber,
            orderIndex: s.orderIndex,
            timeBlock: s.timeBlock,
            suggestedDurationMin: s.suggestedDurationMin,
        })),
    );
}

/** Shallow diff of the metadata form against its loaded baseline. */
export function metadataDirty(form: PlanForm, original: PlanForm): Record<string, unknown> {
    const dirty: Record<string, unknown> = {};
    for (const key of Object.keys(form) as (keyof PlanForm)[]) {
        if (form[key] !== original[key]) dirty[key] = form[key];
    }
    return dirty;
}

/** Stable serialization used to detect whether the stop list changed. */
export function serializeStops(stops: LocalStop[]): string {
    return JSON.stringify(stops);
}

export interface NewStopInput {
    placeId: string;
    placeName: string;
    placeCategory: string;
    dayNumber: number;
    timeBlock?: string;
    durationMin?: number;
}

/**
 * Append a stop to its day at the next order index, unless the day is already
 * full. `added` is false when the per-day cap blocks it (UI shows a notice).
 */
export function addStop(
    stops: LocalStop[],
    input: NewStopInput,
    maxPerDay: number,
): { stops: LocalStop[]; added: boolean } {
    const dayCount = stops.filter((s) => s.dayNumber === input.dayNumber).length;
    if (dayCount >= maxPerDay) return { stops, added: false };

    const newStop: LocalStop = {
        placeId: input.placeId,
        placeName: input.placeName,
        placeCategory: input.placeCategory,
        dayNumber: input.dayNumber,
        orderIndex: dayCount,
        timeBlock: input.timeBlock,
        suggestedDurationMin: input.durationMin,
    };
    return { stops: [...stops, newStop], added: true };
}

/** Remove one stop and renumber the remaining stops of that day to 0..n-1. */
export function removeStop(stops: LocalStop[], dayNumber: number, orderIndex: number): LocalStop[] {
    const filtered = stops.filter((s) => !(s.dayNumber === dayNumber && s.orderIndex === orderIndex));
    let idx = 0;
    return filtered.map((s) => (s.dayNumber === dayNumber ? { ...s, orderIndex: idx++ } : s));
}

/** Swap a stop with its neighbour in the given direction; no-op at the edges. */
export function moveStop(
    stops: LocalStop[],
    dayNumber: number,
    orderIndex: number,
    direction: -1 | 1,
): LocalStop[] {
    const dayStops = stops
        .filter((s) => s.dayNumber === dayNumber)
        .sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = dayStops.findIndex((s) => s.orderIndex === orderIndex);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= dayStops.length) return stops;

    const swapped = [...dayStops];
    [swapped[idx], swapped[targetIdx]] = [swapped[targetIdx], swapped[idx]];
    const reindexed = swapped.map((s, i) => ({ ...s, orderIndex: i }));

    const otherStops = stops.filter((s) => s.dayNumber !== dayNumber);
    return [...otherStops, ...reindexed];
}

export function stopsToPayload(stops: LocalStop[]) {
    return stops.map((s) => ({
        placeId: s.placeId,
        dayNumber: s.dayNumber,
        orderIndex: s.orderIndex,
        timeBlock: s.timeBlock,
        suggestedDurationMin: s.suggestedDurationMin,
    }));
}

export interface SaveApiResult {
    error: string | null;
}
export type SaveApi = (
    path: string,
    options: { method: string; body: unknown },
) => Promise<SaveApiResult>;

export type SavePlanOutcome =
    | { status: 'no-changes' }
    | { status: 'error'; scope: 'meta' | 'stops'; message: string }
    | { status: 'saved' };

/**
 * Orchestrates the (non-atomic) plan save: PATCH metadata then PUT stops,
 * each only when dirty, short-circuiting on the first failure so a later
 * call can never run on top of an error. COMMIT 4 collapses this into the
 * single transactional PATCH once the API endpoint lands in main.
 */
export async function savePlan(
    apiCall: SaveApi,
    id: string,
    params: { metaDirty: Record<string, unknown>; stops: LocalStop[]; stopsChanged: boolean },
): Promise<SavePlanOutcome> {
    const hasMetaChanges = Object.keys(params.metaDirty).length > 0;
    if (!hasMetaChanges && !params.stopsChanged) return { status: 'no-changes' };

    if (hasMetaChanges) {
        const res = await apiCall(`/admin/plans/${id}`, { method: 'PATCH', body: params.metaDirty });
        if (res.error) return { status: 'error', scope: 'meta', message: res.error };
    }

    if (params.stopsChanged) {
        const res = await apiCall(`/admin/plans/${id}/stops`, {
            method: 'PUT',
            body: { stops: stopsToPayload(params.stops) },
        });
        if (res.error) return { status: 'error', scope: 'stops', message: res.error };
    }

    return { status: 'saved' };
}
