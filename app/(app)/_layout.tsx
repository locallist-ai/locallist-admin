import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '../../src/lib/theme';

function HeaderBackButton() {
    const { t } = useTranslation();
    const router = useRouter();
    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(app)');
        }
    };
    return (
        <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t('nav.back')}
            hitSlop={8}
            style={styles.backButton}
        >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.deepOcean} />
        </Pressable>
    );
}

export default function AppLayout() {
    const { t } = useTranslation();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.bgMain },
                headerTintColor: colors.deepOcean,
                headerLeft: () => <HeaderBackButton />,
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: t('nav.curationQueue'),
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="analytics"
                options={{
                    title: t('nav.analytics'),
                }}
            />
            <Stack.Screen
                name="billing"
                options={{
                    title: t('nav.billing'),
                }}
            />
            <Stack.Screen
                name="place/[id]"
                options={{
                    title: t('nav.editPlace'),
                }}
            />
            <Stack.Screen
                name="place/create"
                options={{
                    title: t('nav.createPlace'),
                }}
            />
            <Stack.Screen
                name="plans/create"
                options={{
                    title: t('nav.createPlan'),
                }}
            />
            <Stack.Screen
                name="plans/[id]"
                options={{
                    title: t('nav.editPlan'),
                }}
            />
            <Stack.Screen
                name="places/import-google"
                options={{
                    title: t('nav.importGoogle'),
                }}
            />
        </Stack>
    );
}

const styles = StyleSheet.create({
    backButton: {
        paddingVertical: spacing.xs,
        paddingRight: spacing.sm,
    },
});
