import React from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SwipeCard from './SwipeCard';
import { colors } from '../lib/theme';
import { listStyles as styles } from './listStyles';
import type { StatusTab } from '../lib/dashboardQueries';
import type { PlaceData } from '../types/place';

interface PlacesListProps {
    activeTab: StatusTab;
    places: PlaceData[];
    total: number;
    loading: boolean;
    loadingMore: boolean;
    actionLoading: boolean;
    isDesktop: boolean;
    onLoadMore: () => void;
    onReloadQueue: () => void;
    onApprove: (placeId: string) => void;
    onRejectStart: (placeId: string) => void;
    onPostpone: (placeId: string) => void;
    onStatusChange: (placeId: string, status: StatusTab, reason?: string) => void;
    onDelete: (placeId: string) => void;
}

/**
 * Places content of the dashboard: the swipe deck for the review queue,
 * or a paginated row list with inline actions for published/rejected.
 */
export default function PlacesList({
    activeTab,
    places,
    total,
    loading,
    loadingMore,
    actionLoading,
    isDesktop,
    onLoadMore,
    onReloadQueue,
    onApprove,
    onRejectStart,
    onPostpone,
    onStatusChange,
    onDelete,
}: PlacesListProps) {
    const router = useRouter();

    if (loading) {
        return (
            <View style={styles.centerContentInline}>
                <ActivityIndicator color={colors.electricBlue} size="large" />
            </View>
        );
    }

    if (activeTab === 'in_review') {
        return (
            <View style={styles.deckContainer}>
                {places.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>All caught up!</Text>
                        <Pressable onPress={onReloadQueue} style={styles.reloadBtn}>
                            <Text style={styles.reloadText}>Reload Queue</Text>
                        </Pressable>
                    </View>
                ) : (
                    places.slice(-3).map((place, index, visible) => (
                        <SwipeCard
                            key={place.id}
                            place={place}
                            isTop={index === visible.length - 1}
                            onApprove={() => onApprove(place.id)}
                            onReject={() => onRejectStart(place.id)}
                            onPostpone={() => onPostpone(place.id)}
                            showButtons={isDesktop}
                        />
                    ))
                )}
                {actionLoading && (
                    <View style={styles.actionIndicator}>
                        <ActivityIndicator color={colors.electricBlue} size="small" />
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.listContent}>
            {places.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                        No {activeTab === 'published' ? 'published' : 'rejected'} places
                    </Text>
                </View>
            ) : (
                <>
                    {places.map((item) => (
                        <View key={item.id} style={styles.listItem}>
                            <Pressable style={styles.listItemMain} onPress={() => router.push(`/place/${item.id}`)}>
                                {item.photos?.[0] ? (
                                    <Image source={{ uri: item.photos[0] }} style={styles.listThumb} />
                                ) : (
                                    <View style={[styles.listThumb, { backgroundColor: colors.borderColor }]} />
                                )}
                                <View style={styles.listInfo}>
                                    <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.listSub} numberOfLines={1}>
                                        {item.category}
                                        {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                                        {item.priceRange ? ` · ${item.priceRange}` : ''}
                                    </Text>
                                </View>
                                <Text style={styles.listChevron}>›</Text>
                            </Pressable>
                            <View style={styles.itemActions}>
                                <Pressable
                                    style={styles.actionBtnQueue}
                                    onPress={() => onStatusChange(item.id, 'in_review')}
                                >
                                    <Text style={styles.actionBtnQueueText}>Queue</Text>
                                </Pressable>
                                {activeTab === 'published' ? (
                                    <Pressable
                                        style={styles.actionBtnReject}
                                        onPress={() => onRejectStart(item.id)}
                                    >
                                        <Text style={styles.actionBtnRejectText}>Reject</Text>
                                    </Pressable>
                                ) : (
                                    <>
                                        <Pressable
                                            style={[styles.actionBtnPublish, styles.actionBtnBorderRight]}
                                            onPress={() => onStatusChange(item.id, 'published')}
                                        >
                                            <Text style={styles.actionBtnPublishText}>Publish</Text>
                                        </Pressable>
                                        <Pressable
                                            style={styles.actionBtnDelete}
                                            onPress={() => onDelete(item.id)}
                                        >
                                            <Text style={styles.actionBtnDeleteText}>Delete</Text>
                                        </Pressable>
                                    </>
                                )}
                            </View>
                        </View>
                    ))}
                    {loadingMore ? (
                        <ActivityIndicator color={colors.electricBlue} style={{ paddingVertical: 16 }} />
                    ) : places.length < total ? (
                        <Pressable style={styles.loadMoreBtn} onPress={onLoadMore}>
                            <Text style={styles.loadMoreText}>Load More</Text>
                        </Pressable>
                    ) : null}
                </>
            )}
        </View>
    );
}
