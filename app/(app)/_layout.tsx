import { Stack } from 'expo-router';

export default function AppLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                    title: 'Curation Queue',
                    headerLargeTitle: true,
                    headerStyle: { backgroundColor: '#f8fafc' }
                }}
            />
        </Stack>
    );
}
