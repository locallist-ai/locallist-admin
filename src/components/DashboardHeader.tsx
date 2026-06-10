import React from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    ActivityIndicator,
    StyleSheet,
    ActionSheetIOS,
    Platform,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import type { Mode } from '../lib/dashboardQueries';

interface DashboardHeaderProps {
    mode: Mode;
    refreshing: boolean;
    isDesktop: boolean;
    onRefresh: () => void;
}

/** Logo + refresh / create / logout row. Owns the "+ Create" menu per mode. */
export default function DashboardHeader({ mode, refreshing, isDesktop, onRefresh }: DashboardHeaderProps) {
    const router = useRouter();
    const { signOut } = useAuth();

    const handleCreatePress = () => {
        if (mode === 'plans') {
            router.push('/plans/create');
            return;
        }
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Create manually', 'Import from Google', 'Import batch (links/CSV)', 'Backfill descriptions'],
                    cancelButtonIndex: 0,
                },
                (idx) => {
                    if (idx === 1) router.push('/place/create');
                    else if (idx === 2) router.push('/places/import-google');
                    else if (idx === 3) router.push('/places/import-batch');
                    else if (idx === 4) router.push('/places/backfill-descriptions');
                }
            );
        } else {
            Alert.alert('Add place', '', [
                { text: 'Create manually', onPress: () => router.push('/place/create') },
                { text: 'Import from Google', onPress: () => router.push('/places/import-google') },
                { text: 'Import batch (links/CSV)', onPress: () => router.push('/places/import-batch') },
                { text: 'Backfill descriptions', onPress: () => router.push('/places/backfill-descriptions') },
                { text: 'Cancel', style: 'cancel' },
            ]);
        }
    };

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
                <Pressable style={styles.createBtn} onPress={handleCreatePress}>
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
