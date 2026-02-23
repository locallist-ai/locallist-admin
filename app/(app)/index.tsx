import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import SwipeCard from '../../src/components/SwipeCard';

export default function DashboardScreen() {
    const { signOut } = useAuth();
    const [places, setPlaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Brand colors extracted from LocalList UI
    const colors = {
        deepOcean: '#0f172a',
        electricBlue: '#3b82f6',
        sunsetOrange: '#f97316',
        paperWhite: '#F2EFE9',
        successEmerald: '#10b981',
        error: '#ef4444',
    };

    const loadPlacesQueue = async () => {
        setLoading(true);
        // Fetch places that need curation instead of the default "published" ones
        const res = await api<any>('/places?status=in_review');

        // For now we assume we fetch places that need curation
        if (res.data && res.data.places) {
            setPlaces(res.data.places.slice(0, 10)); // Just 10 to test the stack
        }
        setLoading(false);
    };

    useEffect(() => {
        loadPlacesQueue();
    }, []);

    const handleApprove = async (placeId: string) => {
        // Optimistic UI update
        setPlaces(prev => prev.filter(p => p.id !== placeId));

        // Update backend (e.g. PATCH /places/{id})
        // await api(`/places/${placeId}`, { method: 'PATCH', body: { status: 'approved' } });
    };

    const handleReject = async (placeId: string) => {
        // Optimistic UI update
        setPlaces(prev => prev.filter(p => p.id !== placeId));

        // Update backend 
        // await api(`/places/${placeId}`, { method: 'PATCH', body: { status: 'rejected' } });
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.deepOcean }]}>
                <ActivityIndicator color={colors.electricBlue} size="large" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.deepOcean }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.paperWhite }]}>Curation Queue</Text>
                <Pressable onPress={signOut} style={styles.logoutBtn}>
                    <Text style={{ color: colors.error, fontWeight: '600' }}>Logout</Text>
                </Pressable>
            </View>

            <View style={styles.deckContainer}>
                {places.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={{ color: colors.paperWhite, fontSize: 18 }}>All caught up! 🎉</Text>
                        <Pressable onPress={loadPlacesQueue} style={[styles.reloadBtn, { backgroundColor: colors.electricBlue }]}>
                            <Text style={{ color: colors.paperWhite }}>Reload Queue</Text>
                        </Pressable>
                    </View>
                ) : (
                    places.map((place, index) => {
                        // Render from back to front
                        const isTopCard = index === places.length - 1;
                        return (
                            <SwipeCard
                                key={place.id}
                                place={place}
                                isTop={isTopCard}
                                onApprove={() => handleApprove(place.id)}
                                onReject={() => handleReject(place.id)}
                            />
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60, // Safe area roughly
        paddingHorizontal: 24,
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
    },
    logoutBtn: {
        padding: 8,
    },
    deckContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    reloadBtn: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    }
});
