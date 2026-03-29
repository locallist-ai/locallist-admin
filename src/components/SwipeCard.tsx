import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { PlaceData } from '../types/place';

interface SwipeCardProps {
    place: PlaceData;
    isTop: boolean;
    onApprove: () => void;
    onReject: () => void;
    showButtons?: boolean;
}

export default function SwipeCard({ place, isTop, onApprove, onReject, showButtons = false }: SwipeCardProps) {
    const { width, height } = useWindowDimensions();
    const router = useRouter();
    const SWIPE_THRESHOLD = width * 0.3;

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .enabled(isTop)
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
        })
        .onEnd(() => {
            if (translateX.value > SWIPE_THRESHOLD) {
                translateX.value = withTiming(width * 1.5, { duration: 300 }, () => {
                    runOnJS(onApprove)();
                });
            } else if (translateX.value < -SWIPE_THRESHOLD) {
                translateX.value = withTiming(-width * 1.5, { duration: 300 }, () => {
                    runOnJS(onReject)();
                });
            } else {
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        const rotate = interpolate(translateX.value, [-width / 2, 0, width / 2], [-10, 0, 10]);
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    const nopeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, -width / 4], [0, 1]),
    }));

    const likeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, width / 4], [0, 1]),
    }));

    const cardWidth = Math.min(width * 0.9, 480);
    const cardHeight = height * 0.7;
    const photoUrl = place.photos?.[0];

    const handleEdit = () => {
        router.push(`/place/${place.id}`);
    };

    const cardContent = (
        <Animated.View
            style={[
                styles.card,
                { width: cardWidth, height: cardHeight },
                animatedStyle,
                { position: isTop ? 'relative' : 'absolute' },
            ]}
        >
            {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="cover" />
            ) : (
                <View style={[styles.image, { backgroundColor: '#1e293b' }]} />
            )}

            {/* Swipe labels */}
            <Animated.View style={[styles.label, styles.nopeLabel, nopeStyle]}>
                <Text style={[styles.labelText, { color: '#ef4444' }]}>NOPE</Text>
            </Animated.View>
            <Animated.View style={[styles.label, styles.likeLabel, likeStyle]}>
                <Text style={[styles.labelText, { color: '#10b981' }]}>APPROVE</Text>
            </Animated.View>

            {/* Edit button */}
            <Pressable style={styles.editBtn} onPress={handleEdit} hitSlop={8}>
                <Text style={styles.editIcon}>✎</Text>
            </Pressable>

            {/* Info overlay */}
            <View style={styles.overlay}>
                <View style={styles.headerRow}>
                    <Text style={styles.nameText} numberOfLines={1}>
                        {place.name}
                    </Text>
                    {place.priceRange && (
                        <Text style={styles.priceBadge}>{place.priceRange}</Text>
                    )}
                </View>

                <Text style={styles.subText}>
                    {place.category}
                    {place.neighborhood ? ` · ${place.neighborhood}` : ''}
                    {place.googleRating ? ` · ★ ${place.googleRating}` : ''}
                    {place.googleReviewCount ? ` (${place.googleReviewCount})` : ''}
                </Text>

                {place.whyThisPlace && (
                    <Text style={styles.vibeText} numberOfLines={2}>
                        {place.whyThisPlace}
                    </Text>
                )}

                {place.bestFor && place.bestFor.length > 0 && (
                    <View style={styles.tagsRow}>
                        {place.bestFor.slice(0, 3).map((tag) => (
                            <View key={tag} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </Animated.View>
    );

    return (
        <View style={showButtons ? styles.cardWithButtons : undefined}>
            <GestureDetector gesture={panGesture}>
                {cardContent}
            </GestureDetector>
            {showButtons && isTop && (
                <View style={styles.buttonRow}>
                    <Pressable style={styles.rejectButton} onPress={onReject}>
                        <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                    <Pressable style={styles.editButton} onPress={handleEdit}>
                        <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.approveButton} onPress={onApprove}>
                        <Text style={styles.approveButtonText}>Approve</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: 20,
        paddingBottom: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    nameText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        flex: 1,
        marginRight: 8,
    },
    priceBadge: {
        fontSize: 14,
        fontWeight: '700',
        color: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        overflow: 'hidden',
    },
    subText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
        marginBottom: 8,
    },
    vibeText: {
        fontSize: 14,
        color: '#cbd5e1',
        fontStyle: 'italic',
        lineHeight: 20,
        marginBottom: 8,
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    tag: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tagText: {
        fontSize: 12,
        color: '#93c5fd',
        fontWeight: '600',
    },
    label: {
        position: 'absolute',
        top: 50,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 10,
    },
    labelText: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: 2,
    },
    nopeLabel: {
        right: 40,
        borderColor: '#ef4444',
        transform: [{ rotate: '15deg' }],
    },
    likeLabel: {
        left: 40,
        borderColor: '#10b981',
        transform: [{ rotate: '-15deg' }],
    },
    editBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    editIcon: {
        fontSize: 18,
        color: '#f8fafc',
    },

    // Desktop button controls
    cardWithButtons: {
        alignItems: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        justifyContent: 'center',
    },
    rejectButton: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 12,
    },
    rejectButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    editButton: {
        backgroundColor: '#334155',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 12,
    },
    editButtonText: {
        color: '#f8fafc',
        fontWeight: '700',
        fontSize: 15,
    },
    approveButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 12,
    },
    approveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
