import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

interface PlaceData {
    id: string;
    name: string;
    type: string;
    image?: string;
    city?: string;
}

interface SwipeCardProps {
    place: PlaceData;
    isTop: boolean;
    onApprove: () => void;
    onReject: () => void;
}

export default function SwipeCard({ place, isTop, onApprove, onReject }: SwipeCardProps) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .enabled(isTop)
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (translateX.value > SWIPE_THRESHOLD) {
                // Swiped Right - Approve
                translateX.value = withTiming(width * 1.5, { duration: 300 }, () => {
                    runOnJS(onApprove)();
                });
            } else if (translateX.value < -SWIPE_THRESHOLD) {
                // Swiped Left - Reject
                translateX.value = withTiming(-width * 1.5, { duration: 300 }, () => {
                    runOnJS(onReject)();
                });
            } else {
                // Return to center
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

    const nopeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(translateX.value, [0, -width / 4], [0, 1]);
        return { opacity };
    });

    const likeStyle = useAnimatedStyle(() => {
        const opacity = interpolate(translateX.value, [0, width / 4], [0, 1]);
        return { opacity };
    });

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.card, animatedStyle, { position: isTop ? 'relative' : 'absolute' }]}>
                {place.image ? (
                    <Image source={{ uri: place.image }} style={styles.image} resizeMode="cover" />
                ) : (
                    <View style={[styles.image, { backgroundColor: '#1e293b' }]} />
                )}

                <Animated.View style={[styles.label, styles.nopeLabel, nopeStyle]}>
                    <Text style={[styles.labelText, { color: '#ef4444' }]}>NOPE</Text>
                </Animated.View>

                <Animated.View style={[styles.label, styles.likeLabel, likeStyle]}>
                    <Text style={[styles.labelText, { color: '#10b981' }]}>APPROVE</Text>
                </Animated.View>

                <View style={styles.glassmorphismContainer}>
                    <Text style={styles.nameText}>{place.name}</Text>
                    <Text style={styles.subText}>{place.type} • {place.city || 'Miami'}</Text>
                </View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    card: {
        width: width * 0.9,
        height: height * 0.7,
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
    glassmorphismContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.7)', // Deep Ocean with opacity matching Locallist
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    nameText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    subText: {
        fontSize: 16,
        color: '#cbd5e1',
        fontWeight: '500',
    },
    label: {
        position: 'absolute',
        top: 50,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
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
});
