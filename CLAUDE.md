# LocalList.Admin

Parent context: see `../CLAUDE.md` for brand, domain concepts, and conventions.

When the user says "admin", "erp", "admin app", they mean this project (`LocalList.Admin`).

| | Details |
|---|---|
| **Tech** | Expo (React Native), TypeScript, React Native Reanimated |
| **UI Paradigm** | Swipe UI (Tinder-style curation queue) |
| **Auth** | Firebase / Google Identity (locked to `@locallist.ai` domain) |
| **Purpose** | Internal tool for curators to review places ingested by AI/Data pipelines. |

## Running Locally

```bash
cd LocalList.Admin
npm install
npx expo start --dev-client --port 8084
```

## Key Files

- `app/(app)/index.tsx` — Main Swipe UI screen for curation. Fetches places with `status=in_review`.
- `app/(auth)/login.tsx` — Google Auth login (includes DEV bypass for emulators).
- `src/components/SwipeCard.tsx` — Gesture-handled card for approving/rejecting places.
- `src/lib/api.ts` — API client matching `LocalList.API.NET` structure.
- `src/context/AuthContext.tsx` — Auth state management (JWT + Firebase integration).
