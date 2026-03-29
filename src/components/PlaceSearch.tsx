import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../lib/api';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import type { PlaceData, PlacesResponse } from '../types/place';

interface PlaceSearchProps {
    onSelect: (place: PlaceData) => void;
    placeholder?: string;
}

export default function PlaceSearch({ onSelect, placeholder = 'Search places...' }: PlaceSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceData[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const search = useCallback(async (text: string) => {
        if (text.length < 2) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        setLoading(true);
        const res = await api<PlacesResponse>(
            `/admin/places?status=published&search=${encodeURIComponent(text)}&limit=10`
        );

        if (res.data) {
            setResults(res.data.places);
            setShowDropdown(res.data.places.length > 0);
        }
        setLoading(false);
    }, []);

    const handleChange = (text: string) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(text), 300);
    };

    const handleSelect = (place: PlaceData) => {
        setQuery('');
        setResults([]);
        setShowDropdown(false);
        onSelect(place);
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={handleChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                />
                {loading && <ActivityIndicator color={colors.electricBlue} style={styles.spinner} />}
            </View>

            {showDropdown && (
                <View style={styles.dropdown}>
                    {results.map((place) => (
                        <Pressable
                            key={place.id}
                            style={styles.resultItem}
                            onPress={() => handleSelect(place)}
                        >
                            <Text style={styles.resultName} numberOfLines={1}>
                                {place.name}
                            </Text>
                            <Text style={styles.resultMeta} numberOfLines={1}>
                                {place.category}
                                {place.neighborhood ? ` · ${place.neighborhood}` : ''}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 10,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: colors.bgMain,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        color: colors.textMain,
        fontFamily: fonts.body,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.borderColor,
    },
    spinner: {
        position: 'absolute',
        right: spacing.md,
    },
    dropdown: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.borderColor,
        marginTop: spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    resultItem: {
        padding: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderColor,
    },
    resultName: {
        fontSize: 15,
        fontFamily: fonts.bodySemiBold,
        color: colors.textMain,
    },
    resultMeta: {
        fontSize: 13,
        fontFamily: fonts.body,
        color: colors.textSecondary,
        marginTop: 2,
    },
});
