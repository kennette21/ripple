# Ripple

A social app for sharing posts, reflections, and photos with friends. Built with Expo (React Native) and Supabase.

**Tech stack:** Expo SDK 54 / React Native 0.81 with expo-router, TypeScript, Zustand + TanStack Query for state/data, and Supabase (Postgres, Auth, Storage) as the backend. See `ripple-mvp-spec.md` for the product spec.

## Prerequisites

- Node.js 20+ and npm
- Xcode (for iOS builds) — install from the Mac App Store, then `xcode-select --install`
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`
- [Supabase CLI](https://supabase.com/docs/guides/cli): `brew install supabase/tap/supabase` (plus Docker, only if you want to run Supabase locally)
- Access to: the `kennette21` Expo account (EAS project `ripple`), the Supabase project (`zgjqgspxxqdliwjiltdw`), and the Apple Developer team for `com.proxy.ripple`

## Local development

```bash
git clone https://github.com/kennette21/ripple.git
cd ripple
npm install
cp .env.example .env
```

Fill in `.env` with the Supabase URL and anon key. For the hosted project these are the same values used in `eas.json`:

```
EXPO_PUBLIC_SUPABASE_URL=https://zgjqgspxxqdliwjiltdw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key — see eas.json or Supabase dashboard → Settings → API>
```

> **Warning:** there is currently a single Supabase project serving both development and production. Local development runs against the live database. Be careful with destructive actions, or use the local Supabase stack (below).

Then run the app on the iOS simulator:

```bash
npm run ios          # builds the native app and starts Metro
```

The app uses native modules (contacts, notifications, secure store), so it does **not** run in Expo Go — it needs a development build. `npm run ios` handles this for the simulator. To develop on a physical device, build a dev client once with `eas build --profile development --platform ios`, install it, then start the bundler with `npx expo start --dev-client`.

After the first native build, day-to-day JS changes only need Metro running; you don't need to rebuild unless native dependencies or `app.json` plugins change.

### Checks

There is no test suite yet. Before committing, run:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
```

## Supabase setup

The backend is a hosted Supabase project. The schema lives in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `00001_initial_schema.sql` | Core tables (profiles, posts, follows, friends, etc.) |
| `00002_rls_policies.sql` | Row Level Security policies |
| `00002_storage_buckets.sql` | Storage buckets: `avatars` and `post-images` (both public) |
| `00003_triggers_functions.sql` | Triggers and database functions |
| `00004_private_posts.sql` | ⚠️ **Empty** — change was applied via dashboard, never captured |
| `00005_allow_10_images.sql` | ⚠️ **Empty** — change was applied via dashboard, never captured |

> **Known gap:** the two empty migrations mean `supabase db push` against a fresh project will **not** reproduce the production schema. Before spinning up a new environment, dump the real schema from production (`supabase db pull`) or backfill those migration files.

### Working against the hosted project

```bash
supabase login
supabase link --project-ref zgjqgspxxqdliwjiltdw
supabase db push       # applies any new local migrations
```

Create new schema changes as migration files (`supabase migration new <name>`) rather than editing in the dashboard, so the repo stays the source of truth.

### Running Supabase locally (optional)

With Docker running:

```bash
supabase start         # starts local Postgres, Auth, Storage, Studio
supabase db reset      # applies all migrations + seeds
supabase status        # prints the local URL and anon key
```

Point `.env` at the local stack (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the anon key from `supabase status`). Local auth emails are caught by Inbucket at http://localhost:54324. Local Studio is at http://localhost:54323. Remember the empty-migrations caveat above: the local schema will be missing the private-posts and 10-images changes until those files are backfilled.

### Dashboard configuration (not in migrations)

These settings live only in the Supabase dashboard (Authentication → URL Configuration / Email Templates) and must be verified on any new project:

- **Site URL:** `ripple://`
- **Additional redirect URLs:** `ripple://auth/callback` and `ripple://auth/reset-password` (used by signup confirmation and password reset — see `src/lib/supabase/auth.ts`)
- **Email confirmations** enabled, **double-confirm email changes** enabled (mirrors `supabase/config.toml`)

> ⚠️ As of July 2026 the password-reset and email-change flows were fixed in code but the production dashboard configuration above has **not been verified end-to-end**. Test both flows on a real device before relying on them.

## Deployment

Builds and store submission go through [EAS](https://expo.dev). The project is `ripple` under the `kennette21` Expo account (project ID in `app.json`). iOS signing credentials are stored in EAS and tied to the Apple Developer team for `com.proxy.ripple` — you need to be a member of both.

Build profiles are defined in `eas.json` (`development`, `preview`, `production`); all three currently embed the same hosted Supabase URL/anon key. Version numbers are managed remotely (`appVersionSource: remote`) and the production profile auto-increments the build number.

```bash
eas login

# Internal/TestFlight-style preview build
eas build --profile preview --platform ios

# Production build + submit to App Store Connect
eas build --profile production --platform ios
eas submit --platform ios --latest
```

`eas submit` will walk you through App Store Connect authentication the first time. From there, releases are managed in App Store Connect (TestFlight for testers, then submit for review).

There is no over-the-air update setup (`expo-updates` is not installed) — every JS change ships via a new store build. Android is configured in `app.json` (`com.proxy.ripple`) but no Play Store submission has been set up.

## Project layout

```
app/                  # expo-router routes (file-based navigation)
  (auth)/             # sign in / sign up / password reset
  (main)/             # tab navigator: feed, profile, settings
  friends.tsx         # unified friends screen (All People + Contacts tabs)
src/
  components/         # UI components (PostCard, ui primitives, ...)
  hooks/              # data hooks (social, feed, ...)
  lib/supabase/       # Supabase client, auth helpers, storage helpers
  lib/query/          # TanStack Query keys and client
supabase/
  migrations/         # database schema (see caveats above)
  config.toml         # local-stack config, mirrors hosted auth settings
```
