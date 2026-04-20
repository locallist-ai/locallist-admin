import { defineConfig } from 'vitest/config';

/**
 * Configuración mínima de vitest para testear utilities puras del admin.
 *
 * Nota: el admin es una app Expo (React Native) y la mayoría del código vive
 * en `app/` y `src/components/` con dependencias nativas (react-native,
 * expo-router, etc.) que vitest no puede resolver sin jest-expo. Por eso
 * restringimos el glob a tests dentro de `src/__tests__/` sobre módulos
 * puros de TS (tipos, helpers sin JSX).
 */
export default defineConfig({
    test: {
        include: ['src/**/__tests__/**/*.test.ts'],
        environment: 'node',
        passWithNoTests: true,
    },
});
