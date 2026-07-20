# Maestro acceptance suite

Run the full suite in a visible iOS Simulator with:

```bash
npm run test:e2e
```

The runner opens and boots Simulator, installs a development build if needed,
starts and resets the local seeded Supabase stack, starts Metro, and executes
the flows in the order declared in `config.yaml`. Docker, Xcode, and Maestro
must be installed.

The focused scripts in `package.json` use the same automated bootstrap while
debugging a journey. Use `npm run test:e2e:flows` only when Simulator, Supabase,
and Metro are already ready and you want to invoke Maestro directly.

## Hot-path coverage

| Journey | Flow |
|---|---|
| Email/password sign in and sign out | `auth.yaml` |
| Feed loading and seeded content | exercised by every signed-in flow |
| Create, edit, soft-delete, restore, and permanently delete a reflection | `post-lifecycle.yaml` |
| Select, upload, publish, and clean up a photo post | `photo-post.yaml` |
| Comment/reply/edit composer modes plus comment create/delete | `comments.yaml` |
| Search, follow, and unfollow | `search-follow.yaml` |
| Owner/visitor privacy plus public/private mutations | `private-post-*.yaml` |
| Post gallery paging and fullscreen post/avatar viewing | `photo-viewer.yaml` |
| Profile editing | `profile-edit.yaml` |

The full suite resets the database first. Flows that mutate data also restore
or remove their own temporary records so they remain useful when run alone.
Native pinch gestures, email delivery, Contacts, and push-notification delivery
remain device/system integration checks rather than stable Maestro acceptance
flows.
