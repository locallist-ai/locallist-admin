import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing } from '../lib/theme';
import { STATUS_TABS, type StatusTab } from '../lib/dashboardQueries';

interface StatusTabsProps {
    activeTab: StatusTab;
    counts: Record<StatusTab, number>;
    isDesktop: boolean;
    onSelect: (tab: StatusTab) => void;
}

const TAB_LABEL_KEY = {
    in_review: 'placesList.queue',
    published: 'placesList.published',
    rejected: 'placesList.rejected',
} as const;

/** Queue / Published / Rejected tab row with count badges. */
export default function StatusTabs({ activeTab, counts, isDesktop, onSelect }: StatusTabsProps) {
    const { t } = useTranslation();
    return (
        <View style={[styles.tabsRow, isDesktop && styles.tabsRowDesktop]}>
            {STATUS_TABS.map((tab) => (
                <Pressable
                    key={tab.key}
                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                    onPress={() => onSelect(tab.key)}
                >
                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                        {t(TAB_LABEL_KEY[tab.key])}
                    </Text>
                    <View style={[styles.badge, activeTab === tab.key && styles.badgeActive]}>
                        <Text style={[styles.badgeText, activeTab !== tab.key && styles.badgeTextInactive]}>
                            {counts[tab.key]}
                        </Text>
                    </View>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    tabsRow: {
        flexDirection: 'row', paddingHorizontal: 20, gap: spacing.sm, marginBottom: spacing.md,
    },
    tabsRowDesktop: { maxWidth: 960, alignSelf: 'center', width: '100%' },
    tab: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: 20, borderWidth: 1, borderColor: colors.borderColor,
    },
    tabActive: { backgroundColor: colors.electricBlue, borderColor: colors.electricBlue },
    tabText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
    tabTextActive: { color: '#fff' },
    badge: {
        backgroundColor: colors.borderColor, borderRadius: 10, minWidth: 20, height: 20,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    },
    badgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    badgeText: { fontSize: 11, fontFamily: fonts.bodyBold, color: '#fff' },
    badgeTextInactive: { color: colors.textSecondary },
});
