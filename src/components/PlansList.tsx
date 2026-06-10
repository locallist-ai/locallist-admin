import React from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../lib/theme';
import { listStyles as styles } from './listStyles';
import type { PlanData } from '../types/plan';

interface PlansListProps {
    plans: PlanData[];
    total: number;
    loading: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    onUnpublish: (planId: string) => void;
    onDelete: (planId: string) => void;
}

/** Plans content of the dashboard: paginated showcase list with row actions. */
export default function PlansList({
    plans,
    total,
    loading,
    loadingMore,
    onLoadMore,
    onUnpublish,
    onDelete,
}: PlansListProps) {
    const router = useRouter();

    if (loading) {
        return (
            <View style={styles.centerContentInline}>
                <ActivityIndicator color={colors.electricBlue} size="large" />
            </View>
        );
    }

    return (
        <View style={styles.listContent}>
            {plans.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No plans yet</Text>
                </View>
            ) : (
                <>
                    {plans.map((item) => (
                        <View key={item.id} style={styles.listItem}>
                            <Pressable style={styles.listItemMain} onPress={() => router.push(`/plans/${item.id}`)}>
                                {item.imageUrl ? (
                                    <Image source={{ uri: item.imageUrl }} style={styles.listThumb} resizeMode="cover" />
                                ) : (
                                    <View style={styles.planIcon}>
                                        <Text style={styles.planIconText}>{item.durationDays}d</Text>
                                    </View>
                                )}
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.listSub} numberOfLines={1}>
                                        {item.city} · {item.type}
                                        {item.isShowcase ? ' · Showcase' : ''}
                                    </Text>
                                </View>
                                <View style={styles.planBadges}>
                                    {item.isPublic && <Text style={styles.publicBadge}>Public</Text>}
                                </View>
                                <Text style={styles.listChevron}>›</Text>
                            </Pressable>
                            <View style={styles.itemActions}>
                                {item.isPublic && (
                                    <Pressable
                                        style={[styles.actionBtnReject, styles.actionBtnBorderRight]}
                                        onPress={() => onUnpublish(item.id)}
                                    >
                                        <Text style={styles.actionBtnRejectText}>Unpublish</Text>
                                    </Pressable>
                                )}
                                <Pressable
                                    style={styles.actionBtnDelete}
                                    onPress={() => onDelete(item.id)}
                                >
                                    <Text style={styles.actionBtnDeleteText}>Delete</Text>
                                </Pressable>
                            </View>
                        </View>
                    ))}
                    {loadingMore ? (
                        <ActivityIndicator color={colors.electricBlue} style={{ paddingVertical: 16 }} />
                    ) : plans.length < total ? (
                        <Pressable style={styles.loadMoreBtn} onPress={onLoadMore}>
                            <Text style={styles.loadMoreText}>Load More</Text>
                        </Pressable>
                    ) : null}
                </>
            )}
        </View>
    );
}
