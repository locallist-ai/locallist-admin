# LocalList.Admin

Parent context: see `../CLAUDE.md` for brand, domain concepts, and conventions.

When the user says "admin", "erp", "admin app", they mean this project (`LocalList.Admin`).

| | Details |
|---|---|
| **Tech** | Expo (React Native), TypeScript, React Native Reanimated |
| **UI Paradigm** | Swipe UI (Tinder-style curation queue) |
| **Auth** | Firebase / Google Identity (locked to `@locallist.ai` domain) |
| **Purpose** | Internal tool for curators to review places ingested by AI/Data pipelines. |

## i18n (EN + ES)

**Convención (2026-07-27): el admin YA NO es solo-inglés.** Ahora es **EN + ES (España)** con selector de idioma. Esto revierte la vieja regla "admin solo inglés". Mismo patrón que la app (`i18next` + `react-i18next` + `expo-localization`).

- Infra en `src/lib/i18n/`: `index.ts` (init; idioma por defecto = el del dispositivo, fallback EN; preferencia persistida con **AsyncStorage** —no SecureStore— para que sobreviva recargas también en web, donde el admin se usa sobre todo), `en.ts` + `es.ts` (recursos, `as const`), `i18next.d.ts` (tipado estricto de claves).
- Init: side-effect import `import '../src/lib/i18n'` en `app/_layout.tsx` (antes de cualquier `useTranslation`).
- Selector: `src/components/LanguageToggle.tsx` (toggle EN/ES accesible en el `DashboardHeader`).
- **Paridad EN/ES obligatoria**: `src/__tests__/i18nParity.test.ts` falla ante cualquier drift de claves o placeholders (y prohíbe em-dash en strings).
- Uso: `t('key')`, nunca literales visibles. Añade claves a `en.ts` **y** `es.ts`.
- **Estado (hecho, #42)**: el admin está **completamente traducido a EN+ES**. Cubierto: editores de place/plan (`app/(app)/place/*`, `app/(app)/plans/*`), dashboard, imports (`import-batch`, `import-google`, `backfill-descriptions`), Analíticas (`app/(app)/analytics.tsx` + `src/components/AnalyticsBlocks.tsx`), Facturación (`app/(app)/billing.tsx`, namespace `billing.*`), auth/login y los títulos de navegación (`app/(app)/_layout.tsx`). Ya no queda copy visible en inglés hardcodeado; la paridad EN/ES la impone `src/__tests__/i18nParity.test.ts`.

## Firebase Config

Firebase config del SDK JS viene de `app.config.ts` que parsea `GoogleService-Info.plist` con `plutil` en build time. **No** de `EXPO_PUBLIC_FIREBASE_*` env vars. Para actualizar la config de Firebase, reemplazar el plist y reconstruir.

## Running Locally

```bash
cd locallist-admin
npm install
npx expo start --dev-client --port 8084
```

## iOS Builds (EAS local)

```bash
git add -A && git commit  # EAS reads git HEAD
npm run build:ios   # production (.ipa)
npm run build:sim   # preview / simulator (.tar.gz)
```

Always build through the wrapper (`scripts/build-local.sh`), never raw `eas build`: artifacts land in `builds/<profile>-<date>-<sha>.<ext>` (gitignored) and the wrapper keeps only the 2 most recent per profile.

## Key Files

- `app/(app)/index.tsx` — Main dashboard (~300 lines of composition). Mode toggle (places / plans) + batch-translate overlay; data lives in `usePlacesData` / `usePlansData` / `useFilterState`, UI in `DashboardHeader`, `FilterBar`, `StatusTabs`, `BatchActionsRow`, `PlacesList`, `PlansList`. Swipe UI only for `in_review` places.
- `app/(app)/analytics.tsx` — Product analytics screen (fase 1): Chat block (`chat_turns`: turns/period, cost, latency p50/p95, provider·model mix, slot completeness) + Plans block (`plan_metrics`: plans/period by source, avg cost, % opened/followed), shared preset range (7d/30d/90d/1y/all). Granularity follows the range: daily (7d/30d), weekly (90d), monthly (1y/all); the truncated note flags that long-range series/mixes are the most-recent 2.000 rows (stat cards stay exact via `/stats`). Composition only; data in `useAnalyticsData`, logic in `src/lib/analyticsQueries.ts`. Full i18n (EN+ES via `t()`); cada métrica lleva una LEYENDA de 1 línea tras un icono "i" (`InfoTip`). Pinta también datos que las `/stats` YA devuelven: **Por ciudad** (`byCity`) y los breakdowns de chat **finishReasons/errorCodes** (cero backend nuevo). La monetización (fase 2) NO vive aquí: es una **pantalla propia** (`app/(app)/billing.tsx`) para no tocar la orquestación probada de `loadAnalytics` (sus tests fijan exactamente 4 llamadas).
- `app/(app)/billing.tsx` — Pantalla de **Facturación** (fase 2, monetización): agregados del ledger `billing_events` de RevenueCat vía `GET /admin/billing/metrics?from=&to=` (auth admin FirebaseScheme, mismo cliente `api` que analytics). Secciones: **Resumen** (eventos totales, usuarios únicos, eventos sin asociar, ingresos USD brutos), **Suscripciones** (altas nuevas, inicios de prueba, pago directo, conversiones a pago, renovaciones, reactivaciones), **Bajas y ciclo de vida** (cancelaciones, expiraciones, problemas de cobro, cambios de plan, transferencias), **Desgloses** (byEventType/byProductId/byCountry/byCancelReason/revenueByCurrency como `BarList`) y **Actividad en el tiempo** (serie `daily[]`). Mismo preset range (`RangeSelector`) e InfoTip de leyenda por CADA métrica que la pantalla de Analíticas. **Estado vacío honesto**: `billing_events` está vacío hasta que IAP esté en vivo, así que el backend devuelve un DTO a CEROS (200) y la pantalla pinta ceros/tablas vacías + una nota (`billing.empty.note`), nunca un error ni un blanco. Composición only; datos en `useBillingData`, lógica en `src/lib/billingQueries.ts`, mapping de leyendas en `src/lib/billingLegend.ts`. Navegación: botón "Facturación" en `DashboardHeader` (`onBillingPress` → `router.push('/billing')`, mismo patrón que Analíticas).
- `app/(app)/place/[id].tsx` — Place detail/edit screen (thin composition). Logic lives in `usePlaceForm`; AI description suggestion (`POST /admin/places/{id}/suggest-description`).
- `app/(app)/place/create.tsx` — Place creation form.
- `app/(app)/places/import-batch.tsx` — CSV batch import.
- `app/(app)/places/import-google.tsx` — Google Places import.
- `app/(app)/places/backfill-descriptions.tsx` — AI description backfill tool.
- `app/(app)/plans/[id].tsx` — Plan detail/edit screen (thin composition). Logic lives in `usePlanForm`.
- `app/(app)/plans/create.tsx` — Plan creation form.
- `app/(auth)/login.tsx` — Google Sign-In: Firebase popup on web, native SDK on mobile. Domain locked to `@locallist.ai`.
- `src/components/SwipeCard.tsx` — Gesture-handled card for approving/rejecting places.
- `src/components/DashboardHeader.tsx` — Logo + analytics / billing / refresh / create / logout row (presentational; the "+ Create" menu per mode and the Analytics/Billing navigation live in `index.tsx` via `onCreatePress` / `onAnalyticsPress` / `onBillingPress`).
- `src/components/AnalyticsBlocks.tsx` — Presentational pieces of the Analytics screen: range chips (labels i18n'd via `analytics.ranges.*`), section cards, stat tiles, single-hue `BarList` and per-source `StackedDayBars` (fixed series-color order, no chart libs), `CityStatsTable` (per-city count/opened/followed table), and `InfoTip` (the "i" legend affordance: tap opens a modal with the metric's one-line explanation — RN-web tooltips are unreliable, so tap-to-open is the design). Stat tiles + chart titles accept an optional `info` string.
- `src/components/LanguageToggle.tsx` — Accessible EN/ES toggle button in the `DashboardHeader` (flips `i18n.language`).
- `src/lib/analyticsLegend.ts` — Pure metric -> legend i18n-key mapping (`CHAT_METRICS`/`PLAN_METRICS`, `legendKey`). Tested (every metric has a legend present in EN+ES).
- `src/lib/billingQueries.ts` — Pure logic behind the Billing screen: DTO type of `GET /admin/billing/metrics` (empty-safe: el backend devuelve un DTO a ceros a 200, `isBillingEmpty` distingue el estado pre-IAP), query builder (reusa `rangeForKey` de `analyticsQueries`; all-time omite `from`), row-shaping de las tablas (`billingBreakdownRows` reusa `breakdownToRows`, `revenueByCurrencyRows` nunca suma entre divisas, `dailyToRows` etiqueta cada día), `loadBilling` (una sola request, nunca rechaza — un throw = snapshot de error) y formatters. Tested.
- `src/lib/billingLegend.ts` — Pure metric -> legend i18n-key mapping de Facturación (`BILLING_STAT_METRICS`/`BILLING_BREAKDOWN_METRICS`, `billingLegendKey`). Tested (cada métrica tiene leyenda en EN+ES y label de tarjeta).
- `src/hooks/useBillingData.ts` — Thin React wiring sobre `loadBilling` (espejo de `useAnalyticsData`): un AbortController por carga + guard de request-id monotónico.
- `src/components/FilterBar.tsx` — Name search + city chips; exports `FilterChipRow` (reused for the category filter).
- `src/components/StatusTabs.tsx` — Queue / Published / Rejected tabs with count badges.
- `src/components/BatchActionsRow.tsx` — Translate / Reindex / Hours actions for published places.
- `src/components/PlacesList.tsx` — Swipe deck (queue) or paginated row list with inline actions.
- `src/components/PlansList.tsx` — Paginated showcase plans list with row actions (shares `listStyles.ts`).
- `src/components/BaseModal.tsx` — Shared modal chrome (translucent overlay + bgCard/borderRadius.lg/shadow card). `avoidKeyboard` for forms; `dismissOnBackdropPress` for menus; exports `baseModalStyles` (incl. the `actions` flex-end row). Consumed by RejectionModal, AddSubcategoryModal, OptionsMenuModal.
- `src/components/RejectionModal.tsx` — Modal for entering rejection reason (consumes `BaseModal`).
- `src/components/AddSubcategoryModal.tsx` — Modal for creating subcategories in batch (key + EN/ES labels per row); partial failures keep their rows with inline errors.
- `src/components/PlaceSearch.tsx` — Debounced autocomplete place picker with dropdown.
- `src/components/ErrorBoundary.tsx` — React error boundary wrapper.
- `src/lib/api.ts` — API client matching `LocalList.API.NET` structure.
- `src/lib/firebase.ts` — Firebase SDK init from `expoConfig.extra.firebase` (populated by `app.config.ts` from the plist).
- `src/lib/theme.ts` — Colors, fonts, spacing, borderRadius constants.
- `src/lib/taxonomy.ts` — Static taxonomy: `CATEGORIES`, `SUBCATEGORIES_BY_CATEGORY`, Google types → subcategory mapping. Pickers prefer the live API taxonomy (`useTaxonomy`); the static list is inference + fallback only.
- `src/lib/subcategories.ts` — Pure API calls for creating subcategories (single + batch with partial-failure reporting).
- `src/lib/dashboardQueries.ts` — Pure query/pagination rules for the dashboard (filters, badges, refresh per mode). Tested.
- `src/lib/analyticsQueries.ts` — Pure logic behind the Analytics screen: DTO types of `/admin/analytics/chat-turns[/stats]` and `/admin/analytics/plan-metrics[/stats]` (ojo: `WhenWritingNull` — los `| null` llegan como campo ausente), preset ranges (`RangeKey` 7d/30d/90d/1y/all; `all` → `from: null` y el builder OMITE `from`), range bounds anclado a medianoche UTC (N días = N buckets), granularidad por rango (día/semana/mes vía `granularityForRange`), query builders (limit clamp 200), page-accumulation loop with injected API + AbortSignal + dedupe por id + `truncated` flag, `bucketByPeriod` (día UTC / semana anclada al final del rango en bloques de 7 / mes calendario; para `all` la serie arranca en el `createdAt` más antiguo de la muestra), nearest-rank percentiles, mixes, period-label formatters (día/semana/mes), `loadAnalytics` (full-range orchestration with injected API; never rejects — throws become error snapshots), y `breakdownToRows`/`sortCityStats` (ordenación pura de los distributions que las `/stats` ya devuelven: finishReason/errorCode y byCity). Tested.
- `src/lib/optimisticList.ts` — Pure list/count ops behind optimistic updates with rollback. Tested.
- `src/lib/batchTranslate.ts` — Chunked batch-translate loop with injected API call. Tested.
- `src/lib/planForm.ts` — Pure logic behind `usePlanForm`: plan→form/stops mapping, metadata diff, stop ops (add with per-day cap, remove/move + reindex), and `savePlan` (single atomic `PATCH /admin/plans/{id}` carrying metadata + full stop list, error path) with injected API. Tested.
- `src/lib/placeForm.ts` — Pure logic behind `usePlaceForm`: bestFor tags, photos, ES translation-draft merge, and `savePlace` (PATCH dirty, error path) with injected API. Tested. (Dirty diff stays in `getDirtyFields`.)
- `src/lib/raceGuard.ts` — Pure logic of the monotonic request-id race guard (stale initial must not touch `loading`; stale load-more clears its own flag). Tested.
- `src/lib/asyncFlag.ts` — `withFlag`: raises/lowers a boolean in-flight flag around an async action (try/finally). Wraps `actionLoading` in all dashboard mutations. Tested.
- `src/lib/constants.ts` — Re-exports taxonomy + `PRICE_RANGES`, `BEST_TIMES`, `STATUSES`, `MAX_STOPS_PER_DAY`.
- `src/utils/getDirtyFields.ts` — Dirty-field diff for PATCH bodies (coerces numeric strings from DTO drift). Exporta `PLACE_EDITABLE_KEYS`: gatekeeper del PATCH — un campo editable que no esté en esa lista se descarta silenciosamente al guardar (causa raíz de la pérdida de subcategorías/i18n de jun 2026). Al añadir un campo editable al formulario, añadirlo también ahí.
- `src/context/AuthContext.tsx` — Auth state management (JWT + Firebase integration).
- `src/hooks/useBreakpoint.ts` — Responsive breakpoint hook (isDesktop).
- `src/hooks/useTaxonomy.ts` — Hook for loading taxonomy data.
- `src/hooks/useFilterState.ts` — Dashboard filters: city, category, debounced name search.
- `src/hooks/useAnalyticsData.ts` — Thin React wiring over `loadAnalytics`: one AbortController per load (range toggle/retry/unmount aborta la carga anterior para no quemar el rate limit admin compartido) + monotonic request-id guard.
- `src/hooks/usePlacesData.ts` — Places list + pagination + badge counts + optimistic mutations with rollback.
- `src/hooks/usePlansData.ts` — Plans list + pagination + unpublish/delete. Race-guarded with a monotonic request id (parity with `usePlacesData`).
- `src/hooks/usePlanForm.ts` — Plan edit screen state (load, form, stops, ES translate, save, delete). React wiring over `src/lib/planForm.ts`.
- `src/hooks/usePlaceForm.ts` — Place edit screen state (load, form, tags, photos, ES translate, AI description, subcategories, save). React wiring over `src/lib/placeForm.ts`.
- `src/types/place.ts` — `PlaceData`, `PlacesResponse` types.
- `src/types/plan.ts` — `PlanData`, `PlansResponse` types.

## Verification

```bash
npx tsc --noEmit        # typecheck
npm test                # vitest (pure TS utils únicamente; no contar archivos aquí — se desactualiza)
npm run lint            # expo lint (ESLint flat config)
```

No hay tests de componentes nativos (vitest está acotado a TS puro; los módulos nativos no resuelven en Node). UI visual: simulador o dispositivo físico con dev-client.

Usa `/verify` para ejecutar todo de una vez. Usa `/review-diff` para revisar una rama como staff engineer antes de abrir el PR.
