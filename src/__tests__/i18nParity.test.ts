import { describe, it, expect } from 'vitest';
import en from '../lib/i18n/en';
import es from '../lib/i18n/es';

type TranslationValue = string | Record<string, unknown>;

function collectPaths(obj: Record<string, TranslationValue>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            result[path] = value;
        } else if (typeof value === 'object' && value !== null) {
            Object.assign(result, collectPaths(value as Record<string, TranslationValue>, path));
        }
    }
    return result;
}

function extractPlaceholders(str: string): string[] {
    const names = Array.from(str.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]);
    return Array.from(new Set(names)).sort();
}

describe('admin i18n key parity (en <-> es)', () => {
    const enPaths = collectPaths(en as unknown as Record<string, TranslationValue>);
    const esPaths = collectPaths(es as unknown as Record<string, TranslationValue>);

    const enKeys = Object.keys(enPaths).sort();
    const esKeys = Object.keys(esPaths).sort();

    it('has a non-trivial number of keys (guards against an empty resource)', () => {
        expect(enKeys.length).toBeGreaterThan(30);
    });

    it('es.ts has exactly the same keys as en.ts', () => {
        const missingInEs = enKeys.filter((k) => !(k in esPaths));
        const extraInEs = esKeys.filter((k) => !(k in enPaths));
        expect({ missingInEs, extraInEs }).toEqual({ missingInEs: [], extraInEs: [] });
    });

    it('interpolation placeholders match for every key', () => {
        const mismatches: string[] = [];
        for (const key of enKeys) {
            const enPlaceholders = extractPlaceholders(enPaths[key]);
            const esPlaceholders = extractPlaceholders(esPaths[key] ?? '');
            if (JSON.stringify(enPlaceholders) !== JSON.stringify(esPlaceholders)) {
                mismatches.push(`${key}: en=[${enPlaceholders}] es=[${esPlaceholders}]`);
            }
        }
        expect(mismatches).toEqual([]);
    });

    it('no ES string is left equal to its English source for translated copy', () => {
        // Codes/labels that are legitimately identical across languages
        // (range codes, "Chat", "p95 {{value}}") are allowed to match.
        const allowedEqual = new Set([
            'analytics.ranges.7d',
            'analytics.ranges.30d',
            'analytics.ranges.90d',
            'analytics.chat.title',
            'analytics.chat.latencyP95Hint',
            'analytics.chat.providerModel',
        ]);
        const untranslated = enKeys.filter(
            (k) => !allowedEqual.has(k) && enPaths[k] === esPaths[k],
        );
        expect(untranslated).toEqual([]);
    });

    it('contains no em dash in any UI string (brand rule)', () => {
        const offenders = [...enKeys, ...esKeys].filter(
            (k) => (enPaths[k] ?? '').includes('—') || (esPaths[k] ?? '').includes('—'),
        );
        expect(offenders).toEqual([]);
    });
});
