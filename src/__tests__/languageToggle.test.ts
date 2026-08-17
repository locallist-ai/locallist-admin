import { describe, it, expect } from 'vitest';
import { targetLabel, targetLanguage } from '../lib/languageToggle';

describe('language toggle target-label convention', () => {
    it('switches to the OTHER language', () => {
        expect(targetLanguage('en')).toBe('es');
        expect(targetLanguage('es')).toBe('en');
    });

    it('shows the TARGET language code, not the current one', () => {
        // UI in English -> button reads "ES" (press to get Spanish).
        expect(targetLabel('en')).toBe('ES');
        // UI in Spanish -> button reads "EN" (press to get English).
        expect(targetLabel('es')).toBe('EN');
    });
});
