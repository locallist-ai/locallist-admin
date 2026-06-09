import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
// @ts-ignore — getReactNativePersistence types live under a subpath not resolved by tsc
import { getAuth, Auth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let cachedAuth: Auth | undefined;

export function getFirebaseAuth(): Auth {
    if (cachedAuth) return cachedAuth;

    const fb = Constants.expoConfig?.extra?.firebase as
        | { apiKey: string; authDomain: string; projectId: string }
        | undefined;

    if (!fb?.apiKey || !fb?.authDomain || !fb?.projectId) {
        throw new Error('Firebase config missing in expoConfig.extra — check app.config.ts and GoogleService-Info.plist');
    }

    const app: FirebaseApp = getApps().length === 0
        ? initializeApp(fb)
        : getApps()[0];

    if (Platform.OS === 'web') {
        cachedAuth = getAuth(app);
    } else {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
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
