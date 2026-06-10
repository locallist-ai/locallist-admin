/**
 * Tests de los helpers puros del dashboard (`src/lib/dashboardQueries.ts`):
 * construcción de queries con filtros, reglas de paginación y qué refresca
 * cada modo. Extraídos de app/(app)/index.tsx en la descomposición.
 */
import { describe, it, expect } from 'vitest';
import {
    buildPlacesQuery,
    buildPlansQuery,
    canLoadMore,
    categoryFilterFor,
    pageLimitFor,
    refreshTasksFor,
    shouldUpdateBadge,
    PAGE_SIZE,
    QUEUE_PAGE_SIZE,
} from '../lib/dashboardQueries';

describe('buildPlacesQuery (filtros)', () => {
    it('query mínima: status + paginación, sin filtros', () => {
        expect(buildPlacesQuery({ status: 'published', limit: 20, offset: 40 }))
            .toBe('/admin/places?status=published&limit=20&offset=40');
    });

    it('incluye city, category (en minúsculas) y search cuando están presentes', () => {
        const url = buildPlacesQuery({
            status: 'published', limit: 20, offset: 0,
            city: 'Madrid', category: 'Coffee', search: 'central',
        });
        expect(url).toContain('city=Madrid');
        expect(url).toContain('category=coffee');
        expect(url).toContain('search=central');
    });

    it('omite filtros null o vacíos', () => {
        const url = buildPlacesQuery({
            status: 'in_review', limit: 10, offset: 0,
            city: null, category: null, search: '',
        });
        expect(url).not.toContain('city=');
        expect(url).not.toContain('category=');
        expect(url).not.toContain('search=');
    });

    it('escapa caracteres especiales del search vía URLSearchParams', () => {
        const url = buildPlacesQuery({ status: 'published', limit: 20, offset: 0, search: 'café & tapas' });
        expect(url).toContain('search=caf%C3%A9+%26+tapas');
    });
});

describe('paginación', () => {
    it('la cola de swipe carga un deck corto; el resto, una página completa', () => {
        expect(pageLimitFor('in_review')).toBe(QUEUE_PAGE_SIZE);
        expect(pageLimitFor('published')).toBe(PAGE_SIZE);
        expect(pageLimitFor('rejected')).toBe(PAGE_SIZE);
    });

    it('canLoadMore bloquea con carga en curso o lista ya completa', () => {
        expect(canLoadMore(false, 20, 45)).toBe(true);
        expect(canLoadMore(true, 20, 45)).toBe(false);
        expect(canLoadMore(false, 45, 45)).toBe(false);
        expect(canLoadMore(false, 0, 0)).toBe(false);
    });
});

describe('filtro de categoría', () => {
    it('solo aplica en la pestaña published', () => {
        expect(categoryFilterFor('published', 'Coffee')).toBe('Coffee');
        expect(categoryFilterFor('in_review', 'Coffee')).toBeNull();
        expect(categoryFilterFor('rejected', 'Coffee')).toBeNull();
    });

    it('los badges no se actualizan cuando published está filtrado por categoría', () => {
        expect(shouldUpdateBadge('published', 'Coffee')).toBe(false);
        expect(shouldUpdateBadge('published', null)).toBe(true);
        expect(shouldUpdateBadge('in_review', 'Coffee')).toBe(true);
        expect(shouldUpdateBadge('rejected', 'Coffee')).toBe(true);
    });
});

describe('cambio de modo', () => {
    it('places refresca ciudades + counts + lista; plans solo ciudades + planes', () => {
        expect(refreshTasksFor('places')).toEqual(['cities', 'counts', 'places']);
        expect(refreshTasksFor('plans')).toEqual(['cities', 'plans']);
    });

    it('buildPlansQuery apunta al listado showcase paginado', () => {
        expect(buildPlansQuery(20, 0)).toBe('/admin/plans?isShowcase=true&limit=20&offset=0');
        expect(buildPlansQuery(20, 40)).toBe('/admin/plans?isShowcase=true&limit=20&offset=40');
    });
});
