import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
// @ts-ignore — getReactNativePersistence types live under a subpath not resolved by tsc
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';

let cachedAuth: Auth | undefined;

export function getFirebaseAuth(): Auth {
    if (cachedAuth) return cachedAuth;

    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

    if (!apiKey || !authDomain || !projectId) {
        const missing = ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID']
            .filter(k => !process.env[k])
            .join(', ');
        throw new Error(`Firebase env vars missing: ${missing}`);
    }

    const app: FirebaseApp = getApps().length === 0
        ? initializeApp({ apiKey, authDomain, projectId })
        : getApps()[0];

    if (Platform.OS === 'web') {
        cachedAuth = getAuth(app);
    } else {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            cachedAuth = initializeAuth(app, {
                persistence: getReactNativePersistence(AsyncStorage),
            });
        } catch {
            cachedAuth = getAuth(app);
        }
    }

    return cachedAuth;
}
