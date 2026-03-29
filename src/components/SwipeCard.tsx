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
import { colors, fonts, borderRadius } from '../lib/theme';

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

    const handleEdit = () => {
        router.push(`/place/${place.id}`);
    };

    const tapGesture = Gesture.Tap()
        .enabled(isTop)
        .onEnd(() => {
            runOnJS(handleEdit)();
        });

    const panGesture = Gesture.Pan()
        .enabled(isTop)
        .activeOffsetX([-15, 15])
        .activeOffsetY([-15, 15])
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

    const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

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
                <View style={[styles.image, { backgroundColor: colors.borderColor }]} />
            )}

            {/* Swipe labels */}
            <Animated.View style={[styles.label, styles.nopeLabel, nopeStyle]}>
                <Text style={[styles.labelText, { color: colors.error }]}>NOPE</Text>
            </Animated.View>
            <Animated.View style={[styles.label, styles.likeLabel, likeStyle]}>
                <Text style={[styles.labelText, { color: colors.successEmerald }]}>APPROVE</Text>
            </Animated.View>

            {/* Info overlay — intentionally dark over photos */}
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
            <GestureDetector gesture={composedGesture}>
                {cardContent}
            </GestureDetector>
            {showButtons && isTop && (
                <View style={styles.buttonRow}>
                    <Pressable style={styles.rejectButton} onPress={onReject}>
                        <Text style={styles.rejectButtonText}>Reject</Text>
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
        borderRadius: borderRadius.xl,
        backgroundColor: colors.bgCard,
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
    // Overlay intentionally stays dark — standard pattern over photographs
    overlay: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: 20,
        paddingBottom: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderBottomLeftRadius: borderRadius.xl,
        borderBottomRightRadius: borderRadius.xl,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    nameText: {
        fontSize: 24,
        fontFamily: fonts.bodyBold,
        color: '#fff',
        flex: 1,
        marginRight: 8,
    },
    priceBadge: {
        fontSize: 14,
        fontFamily: fonts.bodyBold,
        color: colors.sunsetOrange,
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    subText: {
        fontSize: 14,
        color: '#94a3b8',
        fontFamily: fonts.bodyMedium,
        marginBottom: 8,
    },
    vibeText: {
        fontSize: 14,
        color: '#cbd5e1',
        fontFamily: fonts.body,
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
        borderRadius: borderRadius.md,
    },
    tagText: {
        fontSize: 12,
        color: '#93c5fd',
        fontFamily: fonts.bodySemiBold,
    },
    label: {
        position: 'absolute',
        top: 50,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 4,
        borderRadius: borderRadius.sm,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 10,
    },
    labelText: {
        fontSize: 32,
        fontFamily: fonts.bodyBold,
        letterSpacing: 2,
    },
    nopeLabel: {
        right: 40,
        borderColor: colors.error,
        transform: [{ rotate: '15deg' }],
    },
    likeLabel: {
        left: 40,
        borderColor: colors.successEmerald,
        transform: [{ rotate: '-15deg' }],
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
        backgroundColor: colors.error,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: borderRadius.md,
    },
    rejectButtonText: {
        color: '#fff',
        fontFamily: fonts.bodyBold,
        fontSize: 15,
    },
    approveButton: {
        backgroundColor: colors.successEmerald,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: borderRadius.md,
    },
    approveButtonText: {
        color: '#fff',
        fontFamily: fonts.bodyBold,
        fontSize: 15,
    },
});
