import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { showAlert } from '../lib/dialogs';
import { api } from '../lib/api';
import { MAX_STOPS_PER_DAY } from '../lib/constants';
import type { PlanData } from '../types/plan';
import type { PlaceData } from '../types/place';
import {
    addStop as addStopPure,
    metadataDirty,
    moveStop as moveStopPure,
    planToForm,
    planToStops,
    removeStop as removeStopPure,
    savePlan,
    serializeStops,
    type LocalStop,
    type PlanForm,
} from '../lib/planForm';

/**
 * Plan edit screen state: load, metadata form, the local stop list with its
 * add/remove/move operations, ES translation suggestion, save and delete.
 * Pure logic lives in `src/lib/planForm.ts`; this hook is the React wiring.
 */
export function usePlanForm(id: string) {
    const router = useRouter();

    const [plan, setPlan] = useState<PlanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<PlanForm>({
        name: '', city: '', type: 'custom', description: '', imageUrl: '',
        durationDays: 1, isPublic: true, isShowcase: false,
        nameEs: null, descriptionEs: null, translationStatusEs: null,
    });
    const originalFormRef = useRef(form);
    const [translating, setTranslating] = useState(false);

    const [stops, setStops] = useState<LocalStop[]>([]);
    const originalStopsRef = useRef<string>('[]');

    // Add-stop form
    const [addDay, setAddDay] = useState(1);
    const [addTimeBlock, setAddTimeBlock] = useState<string | undefined>();
    const [addDuration, setAddDuration] = useState('');

    const loadPlan = useCallback(async () => {
        setLoading(true);
        const res = await api<PlanData>(`/admin/plans/${id}`);
        if (res.data) {
            setPlan(res.data);
            const f = planToForm(res.data);
            setForm(f);
            originalFormRef.current = f;

            const loaded = planToStops(res.data);
            setStops(loaded);
            originalStopsRef.current = serializeStops(loaded);
        } else {
            showAlert('Error', `Failed to load plan: ${res.error}`);
        }
        setLoading(false);
    }, [id]);

    useEffect(() => { loadPlan(); }, [loadPlan]);

    const setField = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const stopsChanged = () => serializeStops(stops) !== originalStopsRef.current;
    const hasChanges =
        Object.keys(metadataDirty(form, originalFormRef.current)).length > 0 || stopsChanged();

    const handleSave = async () => {
        const metaDirty = metadataDirty(form, originalFormRef.current);
        const changed = stopsChanged();

        if (Object.keys(metaDirty).length === 0 && !changed) {
            showAlert('No changes', 'Nothing to save.');
            return;
        }

        setSaving(true);
        const outcome = await savePlan(
            (path, options) => api(path, options),
            id,
            { metaDirty, stops, stopsChanged: changed },
        );
        setSaving(false);

        if (outcome.status === 'error') {
            const what = outcome.scope === 'meta' ? 'plan' : 'stops';
            showAlert('Error', `Failed to update ${what}: ${outcome.message}`);
            return;
        }

        showAlert('Saved', 'Plan updated successfully.');
        await loadPlan();
    };

    const handleDelete = () => {
        showAlert('Delete Plan', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const res = await api(`/admin/plans/${id}`, { method: 'DELETE' });
                    if (res.error) {
                        showAlert('Error', `Failed to delete: ${res.error}`);
                    } else {
                        router.back();
                    }
                },
            },
        ]);
    };

    const handleSuggestTranslation = async () => {
        setTranslating(true);
        const res = await api<{ nameEs: string; descriptionEs: string }>(
            `/admin/plans/${id}/translate`, { method: 'POST' });
        setTranslating(false);
        if (res.data) {
            setForm((f) => ({
                ...f,
                nameEs: res.data!.nameEs ?? f.nameEs,
                descriptionEs: res.data!.descriptionEs ?? f.descriptionEs,
            }));
        } else {
            showAlert('Error', `Translation failed: ${res.error}`);
        }
    };

    const handleAddStop = (place: PlaceData) => {
        const result = addStopPure(
            stops,
            {
                placeId: place.id,
                placeName: place.name,
                placeCategory: place.category,
                dayNumber: addDay,
                timeBlock: addTimeBlock,
                durationMin: addDuration ? parseInt(addDuration, 10) : undefined,
            },
            MAX_STOPS_PER_DAY,
        );
        if (!result.added) {
            showAlert('Limit reached', `Maximum ${MAX_STOPS_PER_DAY} places per day.`);
            return;
        }
        setStops(result.stops);
        setAddDuration('');
        setAddTimeBlock(undefined);
    };

    const removeStop = (dayNumber: number, orderIndex: number) =>
        setStops((prev) => removeStopPure(prev, dayNumber, orderIndex));

    const moveStop = (dayNumber: number, orderIndex: number, direction: -1 | 1) =>
        setStops((prev) => moveStopPure(prev, dayNumber, orderIndex, direction));

    return {
        plan,
        loading,
        saving,
        form,
        setField,
        translating,
        stops,
        addDay,
        setAddDay,
        addTimeBlock,
        setAddTimeBlock,
        addDuration,
        setAddDuration,
        hasChanges,
        handleSave,
        handleDelete,
        handleSuggestTranslation,
        handleAddStop,
        removeStop,
        moveStop,
    };
}
