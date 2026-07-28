import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Image } from 'react-native';
import { useState, useEffect } from 'react';
import {
    signInWithCredential,
    signInWithPopup,
    GoogleAuthProvider,
} from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { getFirebaseAuth } from '../../src/lib/firebase';
import { colors, fonts, spacing, borderRadius } from '../../src/lib/theme';

// Google Sign-In native SDK (mobile only)
let GoogleSignin: any = null;
if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}

export default function LoginScreen() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Configure native Google Sign-In on mobile
        if (GoogleSignin) {
            GoogleSignin.configure({
                scopes: ['email', 'profile'],
                webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
            });
        }
    }, []);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError(null);

            const auth = getFirebaseAuth();
            if (Platform.OS === 'web') {
                // Web: Firebase popup flow
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ hd: 'locallist.ai' });
                const result = await signInWithPopup(auth, provider);

                // Client-side domain check (UX only — backend enforces via AdminAuthorizationFilter)
                if (!result.user.email?.endsWith('@locallist.ai')) {
                    await auth.signOut();
                    throw new Error(t('login.domainError'));
                }
            } else {
                // Mobile: Google Sign-In SDK → Firebase credential
                await GoogleSignin.hasPlayServices();
                const userInfo = await GoogleSignin.signIn();
                const idToken = userInfo.data?.idToken;

                if (!idToken) throw new Error(t('login.noIdToken'));

                // Client-side domain check (UX only)
                const email = userInfo.data?.user.email;
                if (!email?.endsWith('@locallist.ai')) {
                    await GoogleSignin.signOut();
                    throw new Error(t('login.domainError'));
                }

                // Convert Google credential to Firebase auth
                const credential = GoogleAuthProvider.credential(idToken);
                await signInWithCredential(auth, credential);
            }

            // AuthContext's onAuthStateChanged listener handles the rest
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('login.loginFailed');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Image
                    source={require('../../assets/images/icon-text.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>{t('login.title')}</Text>

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                    style={styles.button}
                    onPress={handleGoogleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{t('login.signIn')}</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bgMain,
        padding: spacing.lg,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    logo: {
        width: 180,
        height: 52,
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 22,
        fontFamily: fonts.headingBold,
        color: colors.deepOcean,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        fontFamily: fonts.body,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    button: {
        backgroundColor: colors.electricBlue,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: fonts.bodySemiBold,
    },
    error: {
        color: colors.error,
        fontFamily: fonts.body,
        fontSize: 13,
        marginBottom: spacing.md,
        textAlign: 'center',
        lineHeight: 20,
    },
});
