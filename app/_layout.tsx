import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { colors } from '../src/lib/theme';

function RootLayoutNav() {
    const { token, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!token && !inAuthGroup) {
            // Redirect to the login page.
            router.replace('/(auth)/login');
        } else if (token && inAuthGroup) {
            // Redirect away from the login page.
            router.replace('/(app)');
        }
    }, [token, isLoading, segments]);

    return <Slot />;
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Inter: require('../assets/fonts/Inter-Regular.ttf'),
        InterMedium: require('../assets/fonts/Inter-Medium.ttf'),
        InterSemiBold: require('../assets/fonts/Inter-SemiBold.ttf'),
        InterBold: require('../assets/fonts/Inter-Bold.ttf'),
        PlayfairDisplay: require('../assets/fonts/PlayfairDisplay-Regular.ttf'),
        PlayfairDisplaySemiBold: require('../assets/fonts/PlayfairDisplay-SemiBold.ttf'),
        PlayfairDisplayBold: require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
    });

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgMain }}>
            <StatusBar style="dark" />
            <AuthProvider>
                <RootLayoutNav />
            </AuthProvider>
        </GestureHandlerRootView>
    );
}
