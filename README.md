# Ripple

A social app for sharing posts, reflections, and photos with friends. Built with Expo (React Native) and Supabase.

**Tech stack:** Expo SDK 58 / React Native 0.88 / React 19.3 with expo-router, TypeScript, Zustand + TanStack Query for state/data, and Supabase (Postgres, Auth, Storage) as the backend. See `ripple-mvp-spec.md` for the product spec.

## Prerequisites

- Node.js 22.13+ and npm (verified with Node.js 26.12.1)
- Xcode (for iOS builds) — install from the Mac App Store, then `xcode-select --install`
- Android Studio and its Android SDK (for local Android builds). SDK 58 uses SDK Platform 37, Build-Tools 37.0.0, NDK 27.1.12297006, and Java 21. The SDK Manager can install these components; Gradle can also download missing components after their SDK licenses are accepted.
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

> **Warning:** the hosted Supabase project serves production. Plain `npm start` uses the hosted configuration in `.env`. Use `npm run dev-start` to point the app at the local backend automatically.

For an iPad or iPhone with **Expo Go for SDK 58**, start the local backend and Metro:

```bash
colima start                 # if using Colima as the Docker engine
LOCAL_SUPABASE_HOST=192.168.1.10 npm run dev-start
```

Replace `192.168.1.10` with the Mac's Wi-Fi IPv4 address. Keep the Mac and device on the same trusted Wi-Fi, allow local network access when prompted, and scan Metro's QR code to open the project in Expo Go. After an SDK upgrade, stop the previous Metro process with Ctrl+C before starting it again.

Expo Go is suitable for checking the app's screens and local data. Ripple skips device push registration in Expo Go; in-app notifications still use Supabase. Testing push delivery, app-specific permissions, icons, and splash behavior requires an installed native Ripple build. `expo-dev-client` is installed for native development builds and network inspection. TestFlight distributes packaged beta builds, which do not load edits from the local Metro server.

For a native iOS simulator build, open Xcode and complete its license/setup prompts first. Start `npm run dev-start` in one terminal, then run this in another:

```bash
npm run ios -- --no-bundler   # builds and installs Ripple using the running Metro server
```

After the first native build, day-to-day JS changes only need Metro running. Rebuild after changing native dependencies or config plugins. SDK 58 requires iOS/iPadOS 16.4 or later.

### Inspecting iOS against production

Build and open a native development build in an iPhone simulator:

```bash
npm run inspect:ios
```

This uses the hosted Supabase URL and public anon key from the `production` profile in `eas.json`, and clears local Supabase overrides without changing `.env`. Sign in with an existing Ripple account. Posts, edits, and other actions use real production data. The build uses the current checkout; use the source revision of the shipped build when reproducing a release-specific issue.

Once the native build is installed, restart just Metro with:

```bash
npm run inspect:start
```

Press `i` in Metro to open the installed app in the simulator, and `j` to open React Native DevTools. Use **Expo Network / Network** to inspect requests and **Profiler / Performance** to record component rendering and JavaScript work. Check that image requests appear; native networking coverage can differ from JavaScript fetch coverage. Open DevTools before reproducing a request, and record the same scroll with cold and warm image caches separately.

For a build with Metro already running, use `npm run inspect:ios -- --no-bundler`. Additional Expo iOS options can be passed after `--`, such as `--device "iPhone 17 Pro"`.

Feed photos request a cacheable 1200 × 1200 bounding-box version at quality 75 using Supabase Storage Image Transformations (enabled in production). Aspect ratio is preserved. Only the current and adjacent carousel photos load; fullscreen and pinch-zoom views use the original source. If a transformation fails, that photo falls back to its original URL. Upload compression is unchanged. On iOS, `enforceEarlyResizing` also reduces synchronous native resizing and memory use. Keep cold/first-scroll and warm-scroll measurements separate. Local Instruments traces and benchmark results belong under `.expo/profiling/`, which is ignored by Git. Simulator callback timing helps investigate main-thread stalls; validate GPU frame presentation and device-specific behavior on a physical iPhone.

Xcode 27 displays simulators in **Device Hub** (`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`). If Expo reports an `osascript` / System Events error after the build succeeds, the app may already be installed. Open its simulator window in Device Hub, keep `inspect:start` running, and launch the installed development build directly:

```bash
xcrun simctl openurl booted 'exp+ripple://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081'
```

Development builds and simulator hardware are useful for diagnosis. Validate scrolling performance with a Release build on a physical iPhone and Xcode Instruments; React Native DevTools is a development tool. For that build, run `npm run inspect:ios -- --configuration Release --device`. After CocoaPods installation creates `ios/Ripple.xcworkspace`, open it in Xcode, select the device and Ripple scheme, and choose **Product → Profile**. The scheme's Profile action uses Release configuration. Keep the production environment set when rebuilding from Xcode, since the inspection script's environment applies only to its own process and children.

### with seeded data

Spin up the app + a local postgres container with migrations applied and seeding by running:

```bash
npm run dev-start
```

if you'd like to re-apply the migrations, run with `:reset`

```bash
npm run dev-start:reset
```


### Checks

Before committing, run:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm run test:notifications
npm run test:posts    # photo-only creation and content rules
```

With an iOS development build installed, start the seeded stack in one terminal:

```bash
npm run dev-start:reset
```

Then run Maestro flows from another terminal:

```bash
npm run test:e2e:comments
npm run test:e2e:search-follow
npm run test:e2e:privacy
```

Photo-only post editing requires migration `20261109120000_photo_only_post_edits.sql`
before shipping the updated client. Creation stores an empty caption to remain
compatible with the existing `has_content` constraint. The edit RPC permits an
empty caption only when retaining at least one image from the same post.

To check that migration against the running local database (fixtures are rolled back):

```bash
npx --yes supabase@2.109.1 migration up --local
docker exec -i supabase_db_ripple psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/photo_only_posts.sql
```

### Native projects and SDK compatibility

The generated `ios/` and `android/` projects are local, Git-ignored folders. Their configuration lives in `app.json`, the installed dependencies, and config plugins. Keep native customizations there so future builds can reproduce them.

On a fresh checkout, `npm run ios` or `npm run android` generates the missing platform project before building it. After changing native dependencies or config plugins, sync existing local projects and rebuild:

```bash
npx expo prebuild --no-clean
```

In SDK 58, `npx expo prebuild` recreates both native folders by default; `--no-clean` updates the existing folders in place. CocoaPods must run successfully to create the iOS workspace and `Podfile.lock`. Complete Xcode's license/setup prompts before installing Pods.

EAS Build excludes the local native folders using `.gitignore` and regenerates them in the cloud. No `.easignore` override is used. The splash plugin preserves the previous fullscreen iOS artwork and Android logo size. `expo-build-properties` keeps Android release minification disabled, so regeneration preserves that setting without a manual Gradle edit.

`patch-package` runs automatically after dependency installation. The patch in `patches/react-native-draggable-flatlist+4.0.3.patch` replaces the removed `InteractionManager` call with `requestIdleCallback` and keeps the library on Gesture Handler's compatible legacy list wrappers. Keep that dependency pinned until an upstream release supports the new APIs, then remove or regenerate the patch.

React Compiler is not enabled. Its newly included ESLint diagnostics remain visible as warnings so compiler adoption can be handled separately from the SDK upgrade. The existing hook-order and dependency checks remain enabled.

## Supabase setup

The backend is a hosted Supabase project. The schema lives in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `20260713193010_remote_schema.sql` | Baseline: full production schema (tables, RLS policies, triggers, functions), pulled from prod on 2026-07-13 |
| `20260713193011_storage_buckets.sql` | Storage buckets (`avatars`, `post-images`) and their `storage.objects` policies — maintained by hand since `db pull` doesn't capture them |
| `20260713193012_storage_delete_policies.sql` | Adds the missing delete-own-object policies so `supabase.storage.remove()` works |
| `20260718140000_soft_delete_posts.sql` | Keeps deleted posts recoverable for 30 days and schedules their final purge |
| `20260723120000_notification_preferences.sql` | Replaces the legacy delivery fields with active notification preferences, per-author selections, and authenticated Expo push-device registration |
| `20260723130000_add_new_post_notification_type.sql` | Adds the `new_post` notification type |
| `20260723130100_create_new_post_notifications.sql` | Creates in-app new-post notifications from follow preferences |
| `20260723140000_create_notification_push_webhook.sql` | Sends inserted notifications asynchronously to the push Edge Function using environment-specific Vault values |

> **History note:** the original hand-written migrations (visible in git history before 2026-07-13) were never actually run against production — the live schema was built via the dashboard and had drifted (e.g. `friend_requests` existed only in prod; `usage_sessions`, `push_tokens` and friends existed only in the files). The baseline above replaced them with the real production schema, and the remote migration history table was repaired to match. From here on, all schema changes must go through migration files.

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

Point `.env` at the local stack (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the anon key from `supabase status`). Local auth emails are caught by Inbucket at http://localhost:54324. Local Studio is at http://localhost:54323.

### Recently Deleted

Posts are recoverable for 30 days, then a daily Cron-triggered Edge Function
deletes their database rows and Storage objects. Production setup:

```bash
openssl rand -hex 32
supabase secrets set PURGE_DELETED_POSTS_SECRET=<secret>
```

Add the same secret and project URL to Database Vault (SQL Editor):

```sql
select vault.create_secret('https://zgjqgspxxqdliwjiltdw.supabase.co', 'project_url');
select vault.create_secret('<secret>', 'purge_deleted_posts_secret');
```

```bash
supabase functions deploy purge-deleted-posts
supabase db push
```

Runs appear under Dashboard → Integrations → Cron and Functions → Logs.

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

# Ad hoc preview build for registered devices
eas build --profile preview --platform ios

# Store-signed build from the current branch for TestFlight
eas build --profile production --platform ios

# Upload that specific build to App Store Connect / TestFlight
eas submit --profile production --platform ios --id <build-id>
```

The CLI packages the current working directory, so a feature branch can be tested through TestFlight without merging it into `main`. Commit the intended changes first so the build has a clear source revision. The `production` profile selects store signing and build settings; it does not select a Git branch or publish to the public App Store.

`eas submit` will walk you through App Store Connect authentication the first time. After Apple processes the upload, select the build under TestFlight and make it available to the intended testers. Public App Store release requires a separate App Review/release step. To build and upload together, use `eas build --profile production --platform ios --auto-submit`.

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
