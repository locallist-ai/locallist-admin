import { ExpoConfig, ConfigContext } from '@expo/config';
import * as fs from 'fs';
import * as path from 'path';

// Parseo del plist sin plutil: el build web corre también en Linux (Vercel),
// donde plutil no existe.
function readPlistValue(xml: string, key: string): string {
    const match = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`));
    if (!match) throw new Error(`GoogleService-Info.plist: falta la clave ${key}`);
    return match[1];
}

function readFirebaseConfig() {
    const plistPath = path.join(__dirname, 'GoogleService-Info.plist');
    const xml = fs.readFileSync(plistPath, 'utf8');
    const projectId = readPlistValue(xml, 'PROJECT_ID');
    return {
        apiKey: readPlistValue(xml, 'API_KEY'),
        authDomain: `${projectId}.firebaseapp.com`,
        projectId,
    };
}

export default ({ config }: ConfigContext): ExpoConfig & { main?: string } => ({
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
