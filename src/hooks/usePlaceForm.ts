import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { showAlert } from '../lib/dialogs';
import { api } from '../lib/api';
import { getDirtyFields as computeDirtyFields } from '../utils/getDirtyFields';
import { useTaxonomy } from './useTaxonomy';
import type { PlaceData, PlaceTranslateDraft } from '../types/place';
import type { SubcategoryDraft } from '../lib/subcategories';
import {
    addPhoto as addPhotoPure,
    addTag as addTagPure,
    applyTranslationDraft,
    removePhoto as removePhotoPure,
    removeTag as removeTagPure,
    savePlace,
} from '../lib/placeForm';

/**
 * Place edit screen state: load, the editable form with its dirty diff, the
 * bestFor tags and photo lists, ES translation suggestion, AI description
 * suggestion, dynamic subcategories and save. Pure logic lives in
 * `src/lib/placeForm.ts` and `src/utils/getDirtyFields.ts`; this hook is the
 * React wiring.
 */
export function usePlaceForm(id: string) {
    const router = useRouter();

    const [place, setPlace] = useState<PlaceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<Partial<PlaceData>>({});
    const originalRef = useRef<PlaceData | null>(null);

    const [translating, setTranslating] = useState(false);
    const [suggesting, setSuggesting] = useState(false);

    const [newTag, setNewTag] = useState('');
    const [newPhotoUrl, setNewPhotoUrl] = useState('');

    const { byCategory, createSubcategories } = useTaxonomy();
    const [addSubVisible, setAddSubVisible] = useState(false);

    const loadPlace = useCallback(async () => {
        setLoading(true);
        const res = await api<PlaceData>(`/admin/places/${id}`);
        if (res.data) {
            setPlace(res.data);
            setForm(res.data);
            originalRef.current = res.data;
        } else {
            showAlert('Error', `Failed to load place: ${res.error}`);
        }
        setLoading(false);
    }, [id]);

    useEffect(() => { loadPlace(); }, [loadPlace]);

    const updateField = <K extends keyof PlaceData>(key: K, value: PlaceData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const getDirtyFields = (): Record<string, unknown> => {
        const original = originalRef.current;
        if (!original) return {};
        return computeDirtyFields(original, form);
    };

    const hasDirty = Object.keys(getDirtyFields()).length > 0;

    const handleSave = async () => {
        const dirty = getDirtyFields();
        if (Object.keys(dirty).length === 0) {
            showAlert('No changes', 'Nothing to save.');
            return;
        }

        setSaving(true);
        const outcome = await savePlace((path, options) => api(path, options), id, dirty);
        setSaving(false);

        if (outcome.status === 'saved') {
            originalRef.current = outcome.data;
            setForm(outcome.data);
            setPlace(outcome.data);
            showAlert('Saved', 'Place updated successfully.');
            router.back();
        } else if (outcome.status === 'error') {
            showAlert('Error', `Failed to save: ${outcome.message}`);
        }
    };

    // bestFor tags
    const addTag = () => {
        updateField('bestFor', addTagPure(form.bestFor ?? [], newTag));
        setNewTag('');
    };
    const removeTag = (tag: string) => updateField('bestFor', removeTagPure(form.bestFor ?? [], tag));

    // photos
    const addPhoto = () => {
        updateField('photos', addPhotoPure(form.photos ?? [], newPhotoUrl));
        setNewPhotoUrl('');
    };
    const removePhoto = (url: string) => updateField('photos', removePhotoPure(form.photos ?? [], url));

    const handleSuggestTranslation = async () => {
        if (place?.source !== 'curated') {
            showAlert('Not curated', 'Translation is only available for curated places.');
            return;
        }
        setTranslating(true);
        const res = await api<PlaceTranslateDraft>(`/admin/places/${id}/translate`, { method: 'POST' });
        setTranslating(false);
        if (res.data) {
            setForm((prev) => applyTranslationDraft(prev, res.data!));
        } else {
            showAlert('Error', `Translation failed: ${res.error}`);
        }
    };

    const handleSuggestDescription = async () => {
        setSuggesting(true);
        const res = await api<{ whyThisPlace: string }>(
            `/admin/places/${id}/suggest-description`, { method: 'POST' });
        setSuggesting(false);
        if (res.data?.whyThisPlace) {
            updateField('whyThisPlace', res.data.whyThisPlace);
        } else {
            showAlert('Error', res.error ?? 'Could not generate description.');
        }
    };

    // Subcategories: create against the current category and append the keys
    // that actually got created (onCreated can fire more than once on retry).
    const createSubcategoriesForCurrentCategory = (drafts: SubcategoryDraft[]) =>
        createSubcategories(drafts.map((d) => ({ categoryKey: form.category ?? '', ...d })));

    const appendSubcategories = (keys: string[]) =>
        setForm((prev) => ({
            ...prev,
            subcategories: [...(prev.subcategories ?? []), ...keys],
        }));

    return {
        place,
        loading,
        saving,
        form,
        updateField,
        hasDirty,
        handleSave,
        translating,
        suggesting,
        newTag,
        setNewTag,
        newPhotoUrl,
        setNewPhotoUrl,
        addTag,
        removeTag,
        addPhoto,
        removePhoto,
        handleSuggestTranslation,
        handleSuggestDescription,
        byCategory,
        addSubVisible,
        setAddSubVisible,
        createSubcategoriesForCurrentCategory,
        appendSubcategories,
    };
}
