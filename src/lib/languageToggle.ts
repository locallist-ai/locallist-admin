/**
 * Pure helpers for the header language toggle.
 *
 * Convention: the button shows the TARGET language (the one you switch TO on
 * press), not the current one. Users read a two-letter code as "the language I
 * will get", so showing the target avoids the counterintuitive "press EN, land
 * in Spanish" behavior. The switching action itself always flips to the other
 * language.
 */
export type Lang = 'en' | 'es';

/** The language you switch TO when pressing the toggle (the other one). */
export function targetLanguage(current: Lang): Lang {
    return current === 'es' ? 'en' : 'es';
}

/** Uppercase code shown on the button: the TARGET language. */
export function targetLabel(current: Lang): string {
    return targetLanguage(current).toUpperCase();
}
