import type { PlaceData } from './place';

export interface PlanStopData {
    id: string;
    orderIndex: number;
    timeBlock?: string;
    suggestedArrival?: string;
    suggestedDurationMin?: number;
    place: PlaceData;
}

export interface PlanDayData {
    dayNumber: number;
    stops: PlanStopData[];
}

export interface PlanData {
    id: string;
    name: string;
    city: string;
    type: string;
    description?: string;
    imageUrl?: string;
    durationDays: number;
    isPublic: boolean;
    isShowcase: boolean;
    source?: string;
    tripContext?: Record<string, unknown> | null;
    createdById?: string;
    createdAt?: string;
    updatedAt?: string;
    days?: PlanDayData[];
}

export interface PlansResponse {
    plans: PlanData[];
    total: number;
}
