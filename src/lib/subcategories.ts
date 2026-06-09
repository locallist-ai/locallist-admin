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

export interface CreateSubcategoryPayload {
    categoryKey: string;
    key: string;
    labelEn: string;
    labelEs: string;
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
