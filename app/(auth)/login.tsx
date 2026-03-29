import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import {
    signInWithCredential,
    signInWithPopup,
    GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../../src/lib/firebase';

// Google Sign-In native SDK (mobile only)
let GoogleSignin: any = null;
if (Platform.OS !== 'web') {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}

export default function LoginScreen() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Configure native Google Sign-In on mobile
        if (GoogleSignin) {
            GoogleSignin.configure({
                scopes: ['email', 'profile'],
                webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
                iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
            });
        }
    }, []);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError(null);

            if (Platform.OS === 'web') {
                // Web: Firebase popup flow
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ hd: 'locallist.ai' });
                const result = await signInWithPopup(auth, provider);

                // Client-side domain check (UX only — backend enforces via AdminAuthorizationFilter)
                if (!result.user.email?.endsWith('@locallist.ai')) {
                    await auth.signOut();
                    throw new Error('Please sign in with a @locallist.ai account.');
                }
            } else {
                // Mobile: Google Sign-In SDK → Firebase credential
                await GoogleSignin.hasPlayServices();
                const userInfo = await GoogleSignin.signIn();
                const idToken = userInfo.data?.idToken;

                if (!idToken) throw new Error('No ID token obtained from Google');

                // Client-side domain check (UX only)
                const email = userInfo.data?.user.email;
                if (!email?.endsWith('@locallist.ai')) {
                    await GoogleSignin.signOut();
                    throw new Error('Please sign in with a @locallist.ai account.');
                }

                // Convert Google credential to Firebase auth
                const credential = GoogleAuthProvider.credential(idToken);
                await signInWithCredential(auth, credential);
            }

            // AuthContext's onAuthStateChanged listener handles the rest
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>LocalList Admin</Text>
            <Text style={styles.subtitle}>Curator Dashboard</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
                style={styles.button}
                onPress={handleGoogleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Sign in with Google</Text>
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#94a3b8',
        marginBottom: 48,
    },
    button: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    error: {
        color: '#ef4444',
        marginBottom: 16,
        textAlign: 'center',
    },
});
