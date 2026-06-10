import React from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

interface DashboardHeaderProps {
    refreshing: boolean;
    isDesktop: boolean;
    onRefresh: () => void;
    onCreatePress: () => void;
}

/** Logo + refresh / create / logout row. The "+ Create" menu lives in the screen. */
export default function DashboardHeader({ refreshing, isDesktop, onRefresh, onCreatePress }: DashboardHeaderProps) {
    const { signOut } = useAuth();

    return (
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
            <Image
                source={require('../../assets/images/icon-text.png')}
                style={styles.headerLogo}
                resizeMode="contain"
            />
            <View style={styles.headerRight}>
                <Pressable
                    style={[styles.refreshBtn, refreshing && { opacity: 0.5 }]}
                    onPress={onRefresh}
                    disabled={refreshing}
                >
                    {refreshing
                        ? <ActivityIndicator color={colors.electricBlue} size="small" />
                        : <Text style={styles.refreshBtnText}>⟳</Text>
                    }
                </Pressable>
                <Pressable style={styles.createBtn} onPress={onCreatePress}>
                    <Text style={styles.createBtnText}>+ Create</Text>
                </Pressable>
                <Pressable onPress={signOut} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    headerDesktop: { paddingTop: spacing.lg, maxWidth: 960, alignSelf: 'center', width: '100%' },
    headerLogo: { width: 140, height: 40 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    createBtn: {
        backgroundColor: colors.electricBlue, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: borderRadius.sm,
    },
    createBtnText: { color: '#fff', fontFamily: fonts.bodySemiBold, fontSize: 14 },
    refreshBtn: {
        padding: spacing.sm, borderRadius: borderRadius.sm,
        borderWidth: 1, borderColor: colors.electricBlue,
        alignItems: 'center', justifyContent: 'center',
    },
    refreshBtnText: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 18, lineHeight: 20 },
    logoutBtn: { padding: spacing.sm },
    logoutText: { color: colors.error, fontFamily: fonts.bodySemiBold },
});
