import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import es from './es';

/**
 * Admin i18n (EN + ES). Reverts the old "admin is English-only"
 * convention: the UI now ships English and Spanish with a selector.
 * Default language follows the device (fallback EN); the choice is
 * persisted with AsyncStorage so it survives reloads on web and native
 * (the admin is used mostly in the browser, where SecureStore is a no-op).
 */
const LANG_KEY = 'admin_language';

const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const defaultLang = deviceLang.startsWith('es') ? 'es' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Load the saved preference (async; applies once init has completed).
AsyncStorage.getItem(LANG_KEY)
  .then((saved) => {
    if ((saved === 'en' || saved === 'es') && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  })
  .catch(() => {
    // No persisted preference (or storage unavailable): keep the device default.
  });

// Persist every language change.
i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(LANG_KEY, lng).catch(() => {
    // Best-effort: a failed write just means the next launch uses the device default.
  });
});

export default i18n;
