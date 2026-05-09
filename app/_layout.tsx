import { Slot, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { colors } from '../src/lib/theme';

function RootLayoutNav() {
    const { token, isLoading } = useAuth();
    const segments = useSegments();

    if (isLoading) return null;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) return <Redirect href="/(auth)/login" />;
    if (token && inAuthGroup) return <Redirect href="/(app)" />;

    return <Slot />;
}

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
            <ErrorBoundary>
                <AuthProvider>
                    <RootLayoutNav />
                </AuthProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}
