# Ripple

A social app for sharing posts, reflections, and photos with friends. [MVP spec](ripple-mvp-spec.md)

## Local development

Start Docker and use the [Node.js version from CI](.github/workflows/ci.yml).

```sh
npm ci
npm run dev-start
```

The local accounts are in [the seed file](supabase/seeds/01_auth.sql).

[Startup and reset](scripts/dev-start.js) · [Local Supabase settings](supabase/config.toml) · [npm scripts](package.json)

For plain `npm start` against another backend, copy [`.env.example`](.env.example) to `.env` and fill it in.

With Metro running, build and install the app on an iOS simulator from a second terminal. You’ll need Xcode and CocoaPods.

```sh
npm run ios -- --no-bundler
```

For Android, use Android Studio with JDK 21. Start Metro with `LOCAL_SUPABASE_HOST=10.0.2.2 npm run dev-start` for the standard Android emulator, then run `npm run android -- --no-bundler`.

For Expo Go on a phone or tablet, set `LOCAL_SUPABASE_HOST` to your computer’s LAN IP when starting `dev-start`. Connect both devices to the same network, press `s` in Metro, and scan the QR code with a matching Expo Go version. [Expo SDK version](package.json)

After changing native dependencies or configuration, regenerate the project with `npx expo prebuild --platform ios` or `--platform android`, then rebuild. [Expo config](app.json)

## Checks

See the [CI workflow](.github/workflows/ci.yml) for typecheck and lint. Run all Node tests with `node --test scripts/*.test.js`.

For Maestro, start `npm run dev-start:reset`, open the native app against that Metro server, and run the `test:e2e:*` scripts. [npm scripts](package.json) · [Maestro flows](e2e/maestro)

Run the SQL checks against the seeded local stack. [SQL tests](supabase/tests)

```sh
for test in supabase/tests/*.sql; do
  docker exec -i supabase_db_ripple psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$test" || exit 1
done
```

## iOS inspection

**iOS inspection uses production data.** Press `j` in Metro to open React Native DevTools. [npm scripts](package.json) · [Inspection script](scripts/inspect-ios.js)

Compare feed scrolling against the saved baseline on the same Mac and simulator. [Benchmark script](scripts/profiling/bench-ios.py) · [Saved baseline](scripts/profiling/baseline-build-27.json)

```sh
npm run bench:ios -- --compare scripts/profiling/baseline-build-27.json
```

## Hosted Supabase

Use the subdomain of the EAS Supabase URL as the project ref. Apply pending migrations before releasing a client that depends on them. [Project URL](eas.json) · [Migrations](supabase/migrations)

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Use the site URL and email settings from the local Auth config. Allow the app’s magic-link and password-reset redirects, and verify password reset and email changes on a device. [Auth settings](supabase/config.toml) · [App redirects](src/lib/supabase/auth.ts)

For each Edge Function, set the URL in Vault and store the same shared secret in Vault and the function environment.

- Purge deleted posts. [Vault settings](supabase/migrations/20260718140000_soft_delete_posts.sql) · [Function environment](supabase/functions/purge-deleted-posts/index.ts)
- Push notifications. [Vault settings](supabase/migrations/20260723140000_create_notification_push_webhook.sql) · [Function environment](supabase/functions/send-notification-push/index.ts)

```sh
supabase functions deploy purge-deleted-posts
supabase functions deploy send-notification-push
```

## iOS releases

You’ll need access to the Expo project and its Apple signing team. EAS builds use production Supabase. [Expo project](app.json) · [Build profiles](eas.json)

```sh
eas login
eas build --profile production --platform ios
eas submit --profile production --platform ios --id YOUR_BUILD_ID
```

After the upload finishes processing, assign the build to testers in App Store Connect.
