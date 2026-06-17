# LocalList.Admin

Parent context: see `../CLAUDE.md` for brand, domain concepts, and conventions.

When the user says "admin", "erp", "admin app", they mean this project (`LocalList.Admin`).

| | Details |
|---|---|
| **Tech** | Expo (React Native), TypeScript, React Native Reanimated |
| **UI Paradigm** | Swipe UI (Tinder-style curation queue) |
| **Auth** | Firebase / Google Identity (locked to `@locallist.ai` domain) |
| **Purpose** | Internal tool for curators to review places ingested by AI/Data pipelines. |

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
- `app/(app)/place/[id].tsx` — Place detail/edit screen (thin composition). Logic lives in `usePlaceForm`; AI description suggestion (`POST /admin/places/{id}/suggest-description`).
- `app/(app)/place/create.tsx` — Place creation form.
- `app/(app)/places/import-batch.tsx` — CSV batch import.
- `app/(app)/places/import-google.tsx` — Google Places import.
- `app/(app)/places/backfill-descriptions.tsx` — AI description backfill tool.
- `app/(app)/plans/[id].tsx` — Plan detail/edit screen (thin composition). Logic lives in `usePlanForm`.
- `app/(app)/plans/create.tsx` — Plan creation form.
- `app/(auth)/login.tsx` — Google Sign-In: Firebase popup on web, native SDK on mobile. Domain locked to `@locallist.ai`.
- `src/components/SwipeCard.tsx` — Gesture-handled card for approving/rejecting places.
- `src/components/DashboardHeader.tsx` — Logo + refresh / create / logout row (presentational; the "+ Create" menu per mode lives in `index.tsx` via `onCreatePress`).
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
