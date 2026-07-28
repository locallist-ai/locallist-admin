import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../src/lib/theme';

export default function AppLayout() {
    const { t } = useTranslation();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.bgMain },
                headerTintColor: colors.deepOcean,
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
