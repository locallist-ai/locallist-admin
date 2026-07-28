import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Source-scan guards: vitest here is node-only (no jest-expo), so RN
 * components can't be mounted. These assert against the source text that
 * the Analytics section is driven by i18n `t()` (no visible literals), the
 * legend "i" tip is wired, and the new byCity / breakdown blocks are
 * rendered. They fail if someone reintroduces a hardcoded English string
 * or drops a block.
 */
const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Analytics screen i18n wiring', () => {
    const screen = read('app/(app)/analytics.tsx');

    it('uses react-i18next translation', () => {
        expect(screen).toContain("from 'react-i18next'");
        expect(screen).toMatch(/\bt\(/);
    });

    it('drops the previously hardcoded English UI literals', () => {
        for (const literal of [
            "title=\"Chat\"",
            "title=\"Plans\"",
            "title=\"Turns / period\"",
            "title=\"Provider · model\"",
            "label: 'Turns'",
            "label: 'Plans generated'",
            'Failed to load analytics',
            '>Retry<',
            'No chat turns in this range.',
        ]) {
            expect(screen, `still contains literal: ${literal}`).not.toContain(literal);
        }
    });

    it('renders the new byCity and breakdown blocks (zero-backend data)', () => {
        expect(screen).toContain('CityStatsTable');
        expect(screen).toContain('finishReasonBreakdown');
        expect(screen).toContain('errorCodeBreakdown');
        expect(screen).toContain('byCity');
    });

    it('attaches legend info to tiles and charts', () => {
        expect(screen).toContain('legendKey');
        expect(screen).toMatch(/info:\s*t\(legendKey/);
        expect(screen).toMatch(/info=\{t\(legendKey/);
    });
});

describe('AnalyticsBlocks legend + i18n', () => {
    const blocks = read('src/components/AnalyticsBlocks.tsx');

    it('exports the InfoTip legend affordance and a CityStatsTable', () => {
        expect(blocks).toContain('export function InfoTip');
        expect(blocks).toContain('export function CityStatsTable');
    });

    it('translates range chip labels instead of raw data labels', () => {
        expect(blocks).toContain("from 'react-i18next'");
        expect(blocks).toContain('analytics.ranges.');
    });
});

describe('Navigation titles are i18n-driven', () => {
    const layout = read('app/(app)/_layout.tsx');

    it('uses nav.* keys for every screen title', () => {
        expect(layout).toContain("t('nav.curationQueue')");
        expect(layout).toContain("t('nav.analytics')");
        expect(layout).not.toContain("title: 'Analytics'");
    });
});
