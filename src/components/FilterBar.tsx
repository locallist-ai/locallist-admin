import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';

interface FilterChipRowProps {
    options: readonly string[];
    selected: string | null;
    allLabel: string;
    isDesktop: boolean;
    /** Receives the raw chip value, or null for the "All" chip. Toggle logic belongs to the caller. */
    onSelect: (value: string | null) => void;
}

/** Horizontal chip row with a leading "All" chip that clears the filter. */
export function FilterChipRow({ options, selected, allLabel, isDesktop, onSelect }: FilterChipRowProps) {
    return (
        <View style={isDesktop && styles.filterRowDesktop}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
            >
                <Pressable
                    style={[styles.filterChip, !selected && styles.filterChipActive]}
                    onPress={() => onSelect(null)}
                >
                    <Text style={[styles.filterChipText, !selected && styles.filterChipTextActive]}>
                        {allLabel}
                    </Text>
                </Pressable>
                {options.map((option) => (
                    <Pressable
                        key={option}
                        style={[styles.filterChip, selected === option && styles.filterChipActive]}
                        onPress={() => onSelect(option)}
                    >
                        <Text style={[styles.filterChipText, selected === option && styles.filterChipTextActive]}>
                            {option}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

interface FilterBarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    cities: string[];
    selectedCity: string | null;
    onCityChange: (city: string | null) => void;
    isDesktop: boolean;
}

/** Name search plus the city chip row (places mode only). */
export default function FilterBar({
    searchQuery,
    onSearchChange,
    cities,
    selectedCity,
    onCityChange,
    isDesktop,
}: FilterBarProps) {
    return (
        <>
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    maxLength={100}
                />
                {searchQuery.length > 0 && (
                    <Pressable onPress={() => onSearchChange('')} style={styles.searchClear} hitSlop={8}>
                        <Text style={styles.searchClearText}>×</Text>
                    </Pressable>
                )}
            </View>
            {cities.length > 0 && (
                <FilterChipRow
                    options={cities}
                    selected={selectedCity}
                    allLabel="All Cities"
                    isDesktop={isDesktop}
                    onSelect={onCityChange}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    },
    searchInput: {
        flex: 1, borderWidth: 1, borderColor: colors.borderColor,
        borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bgCard, color: colors.textMain, fontFamily: fonts.body,
        fontSize: 14,
    },
    searchClear: {
        marginLeft: spacing.sm, minWidth: 32, minHeight: 32,
        alignItems: 'center', justifyContent: 'center',
    },
    searchClearText: { fontSize: 22, color: colors.textSecondary, lineHeight: 26 },

    filterRow: {
        paddingHorizontal: 20, gap: spacing.xs, marginBottom: spacing.md,
    },
    filterRowDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1, borderColor: colors.borderColor,
        backgroundColor: colors.bgCard,
    },
    filterChipActive: {
        backgroundColor: colors.deepOcean, borderColor: colors.deepOcean,
    },
    filterChipText: {
        fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textSecondary,
    },
    filterChipTextActive: { color: '#fff' },
});
