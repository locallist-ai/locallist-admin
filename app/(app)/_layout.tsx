import { Stack } from 'expo-router';

const colors = {
    deepOcean: '#0f172a',
    paperWhite: '#F2EFE9',
};

export default function AppLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.deepOcean },
                headerTintColor: colors.paperWhite,
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
        </Stack>
    );
}
