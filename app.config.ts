import { ExpoConfig, ConfigContext } from '@expo/config';
import { execSync } from 'child_process';
import * as path from 'path';

function readFirebaseConfig() {
    const plistPath = path.join(__dirname, 'GoogleService-Info.plist');
    const json = JSON.parse(
        execSync(`plutil -convert json -o - "${plistPath}"`, { encoding: 'utf8' })
    );
    return {
        apiKey: json.API_KEY as string,
        authDomain: `${json.PROJECT_ID}.firebaseapp.com`,
        projectId: json.PROJECT_ID as string,
    };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: 'LocalList Admin',
    slug: 'LocalListAdmin',
    version: '1.0.0',
    main: 'expo-router/entry',
    scheme: 'locallistadmin',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#F2EFE9',
    },
    ios: {
        supportsTablet: true,
        bundleIdentifier: 'com.locallist.admin',
        googleServicesFile: './GoogleService-Info.plist',
        infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
        adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#F2EFE9',
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        package: 'com.locallist.admin',
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
        'expo-secure-store',
        'expo-router',
        '@react-native-google-signin/google-signin',
        'expo-font',
    ],
    extra: {
        router: {},
        eas: { projectId: '46aff2c4-1eaa-4a36-92eb-237da3456bc0' },
        firebase: readFirebaseConfig(),
    },
    owner: 'pablolocallist',
});
