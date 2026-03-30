import { Stack } from 'expo-router';
import { colors } from '../../src/lib/theme';

export default function AppLayout() {
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
                    title: 'Curation Queue',
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="place/[id]"
                options={{
                    title: 'Edit Place',
                }}
            />
            <Stack.Screen
                name="place/create"
                options={{
                    title: 'Create Place',
                }}
            />
            <Stack.Screen
                name="plans/create"
                options={{
                    title: 'Create Plan',
                }}
            />
            <Stack.Screen
                name="plans/[id]"
                options={{
                    title: 'Edit Plan',
                }}
            />
        </Stack>
    );
}
