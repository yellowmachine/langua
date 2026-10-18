# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@0.16.3 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:node" drizzle="database:postgresql+postgresql:postgres.js+docker:yes" mdsvex mcp="ide:claude-code+setup:local" experimental="versions:kit+features:async,remoteFunctions,explicitEnvironmentVariables,handleRenderingErrors,forkPreloads" --install bun langua
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deployment (Dokploy)

`.github/workflows/docker-build.yml` builds and pushes `ghcr.io/yellowmachine/langua:latest` on every push to `main`, then triggers a Dokploy redeploy via the `DOKPLOY_DEPLOY_WEBHOOK_URL` secret (Dashboard Dokploy → app → **General** → **Deployments** → "Copy Webhook"). `docker-compose.prod.yml` sets `pull_policy: always` on `app`/`migrate` so each deploy re-pulls instead of reusing a cached image.

Before calling the webhook, the workflow waits (`docker buildx imagetools inspect`, up to 30×5s) for `:latest` on GHCR to resolve to the digest just pushed — otherwise a deploy could pull the previous image if it fires before the tag finishes propagating.

⚠️ **The webhook endpoint is the same one Dokploy's native "deploy on GitHub push" trigger calls** (`/api/deploy/compose/<refreshToken>`, see [source](https://github.com/Dokploy/dokploy/blob/main/apps/dokploy/pages/api/deploy/compose/%5BrefreshToken%5D.ts)). It only counts as a real deploy trigger if the request carries an `x-github-event` header and a `ref` in the body matching the branch configured in Dokploy — otherwise it responds `301 "Branch Not Match"` without deploying, and since that's not a ≥400 status, a plain `curl --fail` won't catch it (this workflow's webhook call was a silent no-op for months before this was found). The `curl` here sends:

```
-H "x-github-event: push" -d '{"ref": "refs/heads/main", "commits": []}'
```

and checks for `HTTP 200` explicitly. It also requires the **Auto Deploy** toggle (General tab) to be on in Dokploy — turning it off returns `400 "Automatic deployments are disabled for this compose"` and blocks both this webhook and the native trigger (same flag, no way to separate them).

Because Dokploy's native trigger also fires the instant it sees the push (before the image is built), expect **two deploys per push to `main`**: an early one that may grab the previous image, and this workflow's one, which always runs after the new image is confirmed on GHCR. With `pull_policy: always`, the second one re-pulls and wins — no need to disable the native trigger.

## Accounts

There is no public sign-up. The first account (admin) is created at `/setup` while the database has no users; after that, only an admin can add family members, from **Ajustes**. Both call `auth.api.signUpEmail` server-side, and better-auth's own HTTP endpoint (`/api/auth/sign-up/email`) is disabled via `disabledPaths` in `src/lib/server/auth-options.ts` — otherwise anyone who can reach the instance could create an account with a plain `curl`, whatever the UI allows.

## Integrations API (JellyCartoon clips)

Other apps can push content into a user's account over `/api/v1`. Today that's JellyCartoon (the home media server), sending a stretch of the episode/film being watched («manda los últimos 5 minutos a Langua») with its subtitles; it shows up under **Clips**, with the audio, a synced transcript, and word lookup/vocabulary like the chat.

- **Auth**: each user creates tokens in **Mi cuenta → Integraciones** (shown once, revocable). Requests send `Authorization: Bearer lng_…`. Only the token's SHA-256 is stored. `authenticateBearer` (`src/lib/server/api-auth.ts`) returns a `withRLS` bound to the token's owner, the API counterpart of `locals.withRLS`; the token lookup itself goes through the SELECT-only `integration_token_lookup` RLS policy, keyed on the hash.
- **`GET /api/v1/ping`** → `200 {"ok": true}` / `401`.
- **`POST /api/v1/clips`** (multipart): `audio` (M4A, ≤ 15 MB) + `metadata` (JSON). `201 {id, url}`, or `401` / `413` / `422 {message}` with short Spanish messages (JellyCartoon reads them out loud). The contract is in `src/lib/server/clips.ts`.
- **Transcription**: subtitles are used as the transcript when they're in the audio's language. Otherwise (no subtitles, subtitles in another language, or audio language `und`) the clip is answered right away and transcribed afterwards by the local STT, one at a time, streamed from faster-whisper (Bun's `fetch` drops connections that are silent for 300 s). Subtitles in another language are kept as a translation, aligned by time. A transcription lost to a restart can be retried from the clip page.
- **CSRF**: SvelteKit's built-in origin check is replaced by `handleCsrf` in `src/hooks.server.ts`, which does the same but skips `/api/v1` — integrations post multipart server-to-server without an `Origin` header, and those routes never use the session cookie.

### Clip storage and backups

Clip audio is stored behind the `ObjectStorage` interface (`src/lib/server/storage/`), currently a directory: `CLIPS_DIR`, the `clips_data` volume at `/data/clips` in `docker-compose.prod.yml` (`./data/clips` in development). Unlike the TTS cache (`/data/audio`), it can't be regenerated: **back up `clips_data` together with `pgdata`**. Files are only served by the app, to the clip's owner, with byte ranges for seeking.
