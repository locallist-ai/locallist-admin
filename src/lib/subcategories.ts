import { api } from './api';

export interface SubcategoryItem {
    id: string;
    categoryKey: string;
    key: string;
    labelEn: string;
    labelEs: string;
    createdAt: string;
    updatedAt: string;
}

/** One row of the batch-creation modal, before a category is attached. */
export interface SubcategoryDraft {
    key: string;
    labelEn: string;
    labelEs: string;
}

export interface CreateSubcategoryPayload extends SubcategoryDraft {
    categoryKey: string;
}

export const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Validation error for a draft row within its batch, or '' if valid.
 * Only the later of two duplicate rows is flagged.
 */
export function validateDraft(
    draft: SubcategoryDraft,
    index: number,
    all: SubcategoryDraft[],
): string {
    if (draft.key && !SLUG_RE.test(draft.key)) return 'Only lowercase letters, digits, hyphens.';
    if (all.some((d, i) => i < index && d.key && d.key === draft.key)) {
        return 'Duplicate key in this batch.';
    }
    return '';
}

export function isDraftComplete(draft: SubcategoryDraft): boolean {
    return Boolean(
        draft.key.trim() && draft.labelEn.trim() && draft.labelEs.trim() && SLUG_RE.test(draft.key),
    );
}

export interface BatchCreateResult {
    created: SubcategoryItem[];
    failures: { payload: CreateSubcategoryPayload; message: string }[];
}

export async function postSubcategory(payload: CreateSubcategoryPayload): Promise<SubcategoryItem> {
    const res = await api<SubcategoryItem>('/admin/subcategories', { method: 'POST', body: payload });
    if (!res.data) {
        // `||` (not `??`): an empty-string error from the API must still fall back
        throw new Error(res.error || 'Failed to create subcategory.');
    }
    return res.data;
}

/**
 * Creates subcategories one by one (the API has no batch endpoint and an
 * admin rate limit). A failed row never blocks the rest: successes and
 * failures are both reported so the caller can keep what was created.
 */
export async function postSubcategoriesBatch(
    payloads: CreateSubcategoryPayload[],
): Promise<BatchCreateResult> {
    const created: SubcategoryItem[] = [];
    const failures: BatchCreateResult['failures'] = [];

    for (const payload of payloads) {
        try {
            created.push(await postSubcategory(payload));
        } catch (err) {
            failures.push({
                payload,
                message: err instanceof Error ? err.message : 'Failed to create subcategory.',
            });
        }
    }

    return { created, failures };
}
