import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';

export default function LoginScreen() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signIn } = useAuth();

    useEffect(() => {
        // Initialize Google Sign-In
        GoogleSignin.configure({
            // We will need WebClientId and iOSClientId from GCP Console later
            scopes: ['email', 'profile'],
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'PLACEHOLDER',
            iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'PLACEHOLDER',
        });
    }, []);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError(null);

            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.data?.idToken;
            const userEmail = userInfo.data?.user.email;

            if (!idToken) throw new Error('No ID token obtained from Google');

            // Strict Workspace domain restriction
            if (!userEmail?.endsWith('@locallist.ai') && userEmail !== 'pablo@locallist.ai') {
                await GoogleSignin.signOut();
                throw new Error('Unauthorized Access. Please login with a @locallist.ai Workspace account.');
            }

            // Exchange with existing .NET API backend endpoint
            const res = await api<any>('/auth/signin', {
                method: 'POST',
                body: { provider: 'google', idToken: idToken }
            });

            if (res.error || !res.data) {
                throw new Error(res.error || 'Authentication failed on server');
            }

            // Store JWT tokens securely and trigger App redirect
            await signIn(res.data.accessToken);

        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleDevLogin = async () => {
        try {
            setLoading(true);
            setError(null);

            // First attempt to login with a known hardcoded dev password
            let res = await api<any>('/auth/login', {
                method: 'POST',
                body: { email: 'pablo@locallist.ai', password: 'Password123!' }
            });

            // If it fails, maybe the user doesn't exist, try to register
            if (res.error) {
                res = await api<any>('/auth/register', {
                    method: 'POST',
                    body: { email: 'pablo@locallist.ai', password: 'Password123!', name: 'Dev Admin' }
                });
            }

            if (res.error || !res.data) {
                throw new Error(res.error || 'Dev Authentication failed on server');
            }

            await signIn(res.data.accessToken);

        } catch (err: any) {
            setError(err.message || 'Dev Login failed');
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
                    <Text style={styles.buttonText}>Sign in with Google Workspace</Text>
                )}
            </Pressable>

            {/* DEV ONLY BYPASS */}
            <Pressable
                style={[styles.button, { marginTop: 16, backgroundColor: '#475569' }]}
                onPress={handleDevLogin}
                disabled={loading}
            >
                <Text style={styles.buttonText}>[DEV] Sign in without Google</Text>
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
    }
});
