# Clipwave

**Turn long videos into viral shorts with AI.**

Clipwave is a self-hostable AI clipping studio for podcasts, livestreams and long-form video.
Paste a YouTube or Kick link (or upload a file you own), and it transcribes the whole thing,
scores every candidate moment, cuts the best ones, reframes them to 9:16 with face tracking,
burns animated word-by-word captions, generates SEO metadata and exports MP4 + SRT.

Everything runs on real media with real FFmpeg, real Whisper transcription and a real database
queue. **There is no mock data anywhere in the product** — every score, thumbnail, caption and
render you see was produced by the pipeline from the source file you gave it.

```
 ┌────────────┐   ┌───────────────┐   ┌──────────────────────────┐   ┌───────────────┐
 │  Next.js   │   │  API routes   │   │  Worker (separate proc)  │   │  FFmpeg /     │
 │  UI (RSC)  │──▶│  /api/*       │──▶│  jobs table = the queue  │──▶│  Whisper /    │
 │            │◀──│  progress SSE │◀──│  pipeline.ts             │◀──│  OpenCV       │
 └────────────┘   └───────────────┘   └──────────────────────────┘   └───────────────┘
                          │                        │
                    ┌─────▼────────────────────────▼──────┐
                    │  SQLite (zero setup) or Postgres /  │
                    │  Supabase via DATABASE_URL          │
                    └─────────────────────────────────────┘
```

---

## Table of contents

1. [What it does](#what-it-does)
2. [Screens](#screens)
3. [Quick start](#quick-start)
4. [Demo accounts](#demo-accounts)
5. [How the pipeline works](#how-the-pipeline-works)
6. [Plans and limits](#plans-and-limits)
7. [Environment variables](#environment-variables)
8. [Database](#database)
9. [Supabase](#supabase)
10. [Importing from YouTube and Kick](#importing-from-youtube-and-kick)
11. [Subtitles and languages](#subtitles-and-languages)
12. [API reference](#api-reference)
13. [Project structure](#project-structure)
14. [Scripts](#scripts)
15. [Troubleshooting](#troubleshooting)
16. [Security notes](#security-notes)
17. [Known limitations](#known-limitations)

---

## What it does

| Area | Implementation |
| --- | --- |
| **Import** | YouTube URLs (incl. livestream VODs), Kick VODs, or your own uploads (8 MB chunked, resumable). Metadata via oEmbed/Kick API, then `yt-dlp` for authorised media acquisition. |
| **Detection** | Whisper transcript → sentence segmentation → 10 moment categories (funny, reaction, gaming, conversation, emotional, rage, fact, energy, quote, suspense) scored on hook / retention / emotion / energy / humour / surprise / length fit / context completeness. |
| **Cut quality** | Timestamps snap to word boundaries (±0.35 s), clips start and end on complete sentences, overlap suppressed at 35 % (NMS), dead air trimmed. |
| **Reframing** | OpenCV face tracking picks the crop window per clip, with smooth panning and optional auto-zoom. 9:16, 16:9 and 1:1. |
| **Captions** | Word-level highlighting (karaoke style), 6 presets (MrBeast, Gaming, Podcast, Minimal, Bold, Karaoke), editable font/size/colour/outline/shadow/position, ASS burn-in, SRT export. English, Hindi and Nepali supported. |
| **Editor** | Studio per clip: trim, aspect, speed, zoom, background music, intro/outro text, overlay text, caption editing, transcript word editing, re-render with a single API call. |
| **SEO** | 5–10 title variants, description with CTA + source credit, platform-specific hashtag sets (Shorts/TikTok/Reels/Facebook), keyword list, thumbnail text, title/description/hashtag scores, one-click copy. Deterministic engine by default, optional LLM upgrade. |
| **Viral score** | 0–100 with a per-factor breakdown and a plain-language "why this was selected". Explicitly labelled as an AI estimate, not a view prediction. |
| **Thumbnails** | Frame chosen from the clip (face-aware), gradient scrim, category chip, score badge, bold Anton headline, HD 1280×720 JPEG. |
| **Export** | MP4 (720p/1080p, 30 or 60 fps when the source allows), SRT, per-clip download, export history. |
| **Accounts** | Email + password (scrypt), Google OAuth, password reset by email, sessions as httpOnly cookies, per-user isolation on every query. |
| **Billing** | Free / Pro / Ultimate with monthly minutes, clips-per-project, resolution, FPS, watermark, priority and subtitle-style entitlements enforced server-side (`402` on overage). |
| **Admin** | Users, subscriptions, credit adjustments, revenue, jobs, error log, system health — server-side role guard. |

---

## Screens

| Landing | Dashboard |
| --- | --- |
| ![Landing](docs/screens/landing.png) | ![Dashboard](docs/screens/dashboard.png) |

| Project | Clip studio |
| --- | --- |
| ![Project](docs/screens/project.png) | ![Studio](docs/screens/studio.png) |

| Saved clips | Billing |
| --- | --- |
| ![Clips](docs/screens/clips.png) | ![Billing](docs/screens/billing.png) |

Studio tabs — trim with the AI's original cut, SEO with per-title scores, and the score breakdown:
[`studio-trim.png`](docs/screens/studio-trim.png) · [`studio-seo.png`](docs/screens/studio-seo.png) ·
[`studio-score.png`](docs/screens/studio-score.png) · [`studio-captions.png`](docs/screens/studio-captions.png)

Mobile (390 × 844): [`mobile-landing.png`](docs/screens/mobile-landing.png) · [`mobile-dashboard.png`](docs/screens/mobile-dashboard.png)

Real pipeline output (1080×1920, captions burned in, face-tracked crop):

![Rendered clip frame](docs/screens/clip-frame.jpg)

---

## Quick start

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.11+ (22 LTS recommended) | `node -v` |
| FFmpeg + ffprobe | 6.0+ | must be on `PATH`, or set `FFMPEG_PATH` / `FFPROBE_PATH` |
| Python | 3.10–3.13 | only for local Whisper / face tracking (optional) |
| yt-dlp | latest | automatically prepared for URL imports on first run |

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y ffmpeg python3 python3-pip
npm run setup:python                     # project-local venv for faster-whisper, OpenCV and numpy

# macOS
brew install ffmpeg python@3.12 yt-dlp
npm run setup:python
```

Clipwave prepares `yt-dlp` automatically when you run `npm run dev`, `npm run worker`,
`npm run dev:all`, or `npm run host`. It downloads the matching official binary into the
git-ignored `data/tools` folder and checks its SHA-256 checksum. Internet access is needed
the first time. To prepare it manually, run `npm run setup:ytdlp`. Set `YTDLP_PATH` in
`.env.local` to use a binary you installed yourself. Official release files are listed in
the [yt-dlp README](https://github.com/yt-dlp/yt-dlp#release-files).

### 1. Install

```bash
git clone <your-fork> clipwave && cd clipwave
npm install
cp .env.example .env.local
```

Open `.env.local` and set at minimum:

```ini
SESSION_SECRET=<paste a long random string>
ADMIN_PASSWORD=<something only you know>
```

Everything else has a working default: SQLite database, local storage under `data/`,
local Whisper (`WHISPER_MODEL=small` — use `tiny`/`base` on low-RAM machines).

### 2. Create the schema

```bash
npm run db:init     # applies db/migrations/*.sql in order
npm run seed        # admin + demo accounts, sample settings
```

### 3. Run it

**One command** (recommended) — checks the toolchain, applies migrations, seeds accounts,
builds and starts the web app **and** the worker together:

```bash
npm run host              # http://localhost:3000
PORT=4000 npm run host    # different port
MODE=dev npm run host     # hot reload instead of a production build
REBUILD=1 npm run host    # force a fresh build
```

Or run the two processes yourself:

```bash
# terminal 1
npm run dev         # http://localhost:3000

# terminal 2
npm run worker      # the worker does all heavy lifting
```

Or both at once:

```bash
npm run dev:all     # scripts/dev-all.sh — web + worker with prefixed logs
```

Open <http://localhost:3000>, sign in with a demo account, paste a link or upload a file.

### 4. Production

```bash
npm run build
npm start           # web
npm run worker      # worker (keep it alive with systemd/pm2/docker)
```

`GET /api/health` is intentionally absent — use `POST/GET /api/dashboard` with a session, or
watch the worker log (`worker … online · concurrency=1 · stt=local · llm=off`).

---

## Demo accounts

Created by `npm run seed` (override with `ADMIN_EMAIL` / `DEMO_EMAIL` in `.env.local`):

| Role | Email | Password | Plan |
| --- | --- | --- | --- |
| Admin | `admin@clipwave.app` | `change-me-now` (from `ADMIN_PASSWORD`) | Ultimate |
| Creator | `demo@clipwave.app` | `demo12345` (from `DEMO_PASSWORD`) | Pro |

Set `SEED_DEMO_USER=false` to skip the creator account in production, and change
`ADMIN_PASSWORD` before deploying.

---

## How the pipeline works

`src/lib/pipeline.ts` is the single source of truth. A job row in `jobs` is the queue;
the worker claims the oldest eligible job with the highest plan priority.

```
1  acquire     yt-dlp (URL) or the uploaded file → data/storage/projects/<id>/source.mp4
2  probe       duration, fps, resolution, audio presence
3  poster      frame at 10 % of the video → project thumbnail (uploads)
4  transcribe  ffmpeg → 16 kHz mono WAV → faster-whisper / Whisper API → word timestamps
5  acoustics   RMS + dB envelope every 100 ms, speech/no-speech, laughter spikes
6  detect      transcript sentences × acoustic features → candidate windows per target length
7  score       0–100 per moment (weights below), NMS at 35 % overlap, sentence snapping
8  reframe     OpenCV face boxes sampled every 500 ms → smoothed crop path
9  render      single FFmpeg pass: crop → scale → speed → zoom → music → ASS captions → x264
10 metadata    SEO block per clip (titles, description, hashtags, keywords, scores)
11 thumbnail   face-aware still → scrim + headline + badge → 1280×720 JPEG
12 settle      usage events, quota accounting, project status, logs
```

Score weights (sum = 1.0):

```
hook .20 · retention .18 · emotion .15 · energy .12 · surprise .12
humour .09 · lengthFit .08 · contextCompleteness .06
```

Every rendered clip stores its `breakdown` so the UI can explain itself — and the UI always
labels the number as an AI estimate, never as a promise of views.

Retries: a failed job is retried once automatically, then marked `failed` with the error
message surfaced in the project page and the admin error log.

---

## Plans and limits

| | Free | Pro | Ultimate |
| --- | --- | --- | --- |
| Minutes / month | 30 | 300 | 1,000 |
| Clips per project | 5 | 30 | 100 |
| Max source length | 45 min | 180 min | 600 min |
| Resolution | 720p | 1080p | 1080p |
| Frame rate | 30 fps | 30 fps | 30 / 60 fps |
| Watermark | yes | no | no |
| Subtitle styles | 2 basic (minimal, podcast) | + MrBeast, Bold, Karaoke | all six |
| Worker priority | 0 | 5 | 10 |
| Concurrent jobs | 1 | 3 | 8 |

Limits live in `src/lib/plans.ts` and are enforced in three places: the API (before a job is
queued — `402` with code `quota`), the worker (per-project clip cap, source length), and the
UI (locked controls with upgrade hints). Plan changes happen in **Billing → change plan**.

---

## Environment variables

Copy `.env.example` → `.env.local`. Every value is optional except `SESSION_SECRET`.

### Core

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` | Absolute URLs (OAuth redirects, emails, metadata) |
| `SESSION_SECRET` | — | Signs session tokens / password-reset tokens. **Change it.** |
| `SESSION_TTL_DAYS` | `30` | Session lifetime |
| `DATABASE_URL` | *(empty)* | `postgresql://…` for Postgres/Supabase. Empty → SQLite |
| `SQLITE_PATH` | `data/clipwave.db` | SQLite file when no `DATABASE_URL` |
| `STORAGE_DIR` | `data/storage` | Media root (source, frames, renders, thumbnails) |
| `MAX_UPLOAD_BYTES` | `2147483648` | Upload cap (2 GB) |

### Auth

| Variable | Default | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Enables "Continue with Google". Redirect URI: `{APP_URL}/api/auth/google/callback` |
| `RESEND_API_KEY` | — | Sends password-reset mail. Empty → `.eml` files in `data/outbox/` |
| `EMAIL_FROM` | `Clipwave <noreply@clipwave.app>` | From header |

### Google AdSense

After your site is approved in AdSense, set `NEXT_PUBLIC_ADSENSE_CLIENT_ID` to your `ca-pub-...` client ID and
`ADSENSE_PUBLISHER_ID` to the corresponding `pub-...` ID. Clipwave loads the AdSense script site-wide for Auto ads,
serves the matching authorized-seller record at `/ads.txt`, and can render an optional labeled landing-page unit when
`NEXT_PUBLIC_ADSENSE_HOME_SLOT` is set to a slot ID. Restart development or rebuild production after changing these
variables. AdSense must approve the deployed domain before it will serve paid ads. `NEXT_PUBLIC_ADBLOCK_GATE=true`
shows an allow-ads page when the AdSense script is blocked; use `false` to disable that gate. Browser extensions can
still block ad requests, so this setting detects a blocked script and asks the visitor to allow it rather than
circumventing the blocker.

### Media

| Variable | Default | Purpose |
| --- | --- | --- |
| `FFMPEG_PATH` / `FFPROBE_PATH` | `ffmpeg` / `ffprobe` | Binary paths |
| `YTDLP_PATH` | `yt-dlp` | Used for URL imports |
| `PYTHON_BIN` | `python3` | Python interpreter for STT / face tracking; `npm run setup:python` creates a project-local environment and sets this in `.env.local` |
| `ALLOW_REMOTE_FETCH` | `true` | Set `false` for an upload-only deployment |
| `MAX_SOURCE_SECONDS` | `10800` | Hard ceiling regardless of plan |
| `YTDLP_COOKIES_FILE` | — | Netscape cookie jar for content you have access to |
| `YTDLP_PROXY` | — | Proxy URL, useful on datacenter IPs |

### Speech to text

| Variable | Default | Purpose |
| --- | --- | --- |
| `STT_PROVIDER` | `local` | `local` (faster-whisper), `openai`, or `none` |
| `WHISPER_MODEL` | `small` | `tiny` · `base` · `small` · `medium` · `large-v3` |
| `WHISPER_DEVICE` | `cpu` | `cpu` or `cuda` |
| `WHISPER_COMPUTE_TYPE` | `int8` | `int8`, `int8_float16`, `float16`, `float32` |
| `OPENAI_API_KEY` | — | Required when `STT_PROVIDER=openai` |

### LLM (optional)

Any OpenAI-compatible endpoint. Without a key, Clipwave uses its deterministic moment-ranking
and SEO engines — output quality is good, variety is just narrower.

| Variable | Default |
| --- | --- |
| `LLM_API_KEY` | — |
| `LLM_BASE_URL` | `https://api.openai.com/v1` |
| `LLM_MODEL` | `gpt-4o-mini` |

### Worker and billing

| Variable | Default | Purpose |
| --- | --- | --- |
| `WORKER_CONCURRENCY` | `1` | Parallel jobs per worker process |
| `WORKER_POLL_MS` | `1500` | Queue poll interval |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@clipwave.app` / `change-me-now` | Seed values |
| `DEMO_EMAIL` / `DEMO_PASSWORD` / `SEED_DEMO_USER` | `demo@clipwave.app` / `demo12345` / `true` | Seed values |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | — | Reserved for hosted checkout; self-serve plan switching is used when empty |

> API keys are read **server-side only** (`src/lib/env.ts`). No secret is ever imported into a
> client component and no key is exposed through `/api/*`.

---

## Database

Migrations are plain SQL in `db/migrations/` and are applied in filename order:

```
0001_init.sql      users, sessions, password_resets, projects, clips, jobs, job_logs,
                   exports, usage_events, user_settings, error_logs, admin_audit
0002_started_at.sql  projects.started_at (queue SLA + progress timing)
```

```bash
npm run db:init     # apply pending migrations
npm run db:reset    # drop and rebuild (asks nothing — dev only)
```

The driver in `src/lib/db.ts` speaks the same SQL dialect to both engines (SQLite by default,
Postgres/Supabase when `DATABASE_URL` is set), so migrations run against either.

---

## Supabase

Clipwave runs on plain Postgres over `DATABASE_URL`, and it is **verified end to end on
Supabase** (project created, schema applied, accounts seeded, a full clipping run completed,
media served from local storage).

1. **Create the project** at <https://supabase.com> → *New project*.
2. **Copy the transaction-pooler string**: *Project → Connect → Transaction pooler* (port **6543**).
   ```ini
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=no-verify
   ```
   Why this host: the direct string (`db.<ref>.supabase.co:5432`) is IPv6-only on newer projects
   and is unreachable from most Docker/CI/cloud hosts. The pooler is IPv4.
   `sslmode=no-verify` keeps TLS on but skips the pooler's self-signed chain — use
   `sslmode=verify-full` plus a CA bundle if your policy requires strict verification.
3. **Apply the schema and seed accounts**
   ```bash
   npm run db:init     # creates all 12 tables + _migrations on Postgres
   npm run seed        # admin + demo accounts
   ```
   The same migrations also run inside the Supabase SQL editor (`db/migrations/*.sql` is
   portable SQL — no SQLite-only syntax).
4. **Optional — move local data up**
   ```bash
   npm run db:copy            # SQLite → DATABASE_URL, refuses if the target has users
   npm run db:copy -- --force # overwrite
   ```
   Media files are **not** copied: they stay in `STORAGE_DIR` and the stored relative paths keep
   resolving through `/api/media/...`. Point a production deploy at an object store by replacing
   the helpers in `src/lib/storage.ts`.
5. **Run it** — `npm run dev:all` (or `npm start` + `npm run worker`).

Notes that matter in production:

* Transactions are pinned to a single pooled connection (`src/lib/db.ts` → `withTransaction`), so
  job claiming stays atomic behind pgbouncer. Don't wrap `transaction()` calls in your own
  `BEGIN`.
* Connection count: the pool defaults to 10 per process (`PG_POOL_MAX`). With the free pooler
  tier, keep web + worker instances modest.
* **Auth**: Supabase Auth is intentionally not used — Clipwave ships scrypt hashing, hashed
  session tokens in httpOnly cookies and Google OAuth. The `users`, `sessions` and
  `password_resets` tables are the contract if you later migrate to `auth.users`.
* **Storage**: swap the five helpers in `src/lib/storage.ts` for Supabase Storage/S3 calls;
  nothing else in the app touches the filesystem directly.

## Importing from YouTube and Kick

Clipwave only fetches what the platform exposes publicly — it does not bypass DRM, paywalls,
private videos or any other access control. Private, deleted, members-only or geo-blocked
videos return a clear error and, where relevant, the upload fallback is offered in the UI.

| Platform | Metadata | Media |
| --- | --- | --- |
| YouTube | oEmbed (no key) | `yt-dlp` |
| Kick | `kick.com/api/v2` | `yt-dlp` |
| Your own file | — | chunked upload → local storage |

**If YouTube answers "Sign in to confirm you're not a bot"** you are being rate-limited at the
IP level (common on cloud/datacenter hosts). Clipwave surfaces this as an actionable error.
Two supported fixes:

1. Provide cookies for an account you control:
   ```ini
   YTDLP_COOKIES_FILE=/absolute/path/cookies.txt   # exported from your browser
   ```
2. Route the fetch through a proxy:
   ```ini
   YTDLP_PROXY=http://user:pass@host:port
   ```
3. Or simply **upload the file** — the full pipeline (transcription, scoring, reframing,
   captions, SEO, thumbnails, export) is identical for uploads.

Always respect the terms of service and copyright of the platforms you import from, and only
clip content you own or are licensed to use.

---

## Subtitles and languages

* **STT**: faster-whisper locally (word timestamps), or the Whisper API. Language is detected
  automatically; `hi` (Hindi) and `ne` (Nepali) are first-class.
* **Styles**: `mrbeast`, `gaming`, `podcast`, `minimal`, `bold`, `karaoke` — each defines font,
  size, primary/highlight colour, outline, shadow, position, animation and per-word emphasis.
* **Burning**: captions are rendered to ASS and burned in the same FFmpeg pass as the crop, so
  there is no second encode and no drift.
* **Editing**: the studio lets you change style, font, size, colours, position and animation,
  then edit individual words. Edited words are posted back with the render request
  (`overrides.words`) and the ASS is rebuilt from them.
* **Fonts**: Devanagari needs `Noto Sans Devanagari`, Latin display text uses `Anton`/`Poppins`.
  `npm run setup:fonts` installs them into the system font directory (Linux) — see the script
  for macOS/Windows equivalents.
* **SRT**: `GET /api/clips/[id]/download?format=srt` returns a clean `.srt` for the clip window.

---

## API reference

All endpoints are JSON, cookie-authenticated, and scoped to the signed-in user.

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account, start session |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/me` | Current user + plan |
| `PATCH` | `/api/auth/profile` | Name / avatar / password |
| `POST` | `/api/auth/forgot-password` | Send reset mail |
| `POST` | `/api/auth/reset-password` | Consume token |
| `GET` | `/api/auth/google/start` · `/callback` | OAuth |

### Projects and imports

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/sources/resolve` | Validate URL, fetch title/thumbnail/duration |
| `POST` | `/api/projects` | Create project from a resolved URL and queue the job |
| `GET` | `/api/projects` | List (`?status=`, `?limit=`, `?cursor=`) |
| `GET` | `/api/projects/[id]` | Project + clips + moments + logs + exports |
| `DELETE` | `/api/projects/[id]` | Delete project and its media |
| `GET` | `/api/projects/[id]/progress` | Poll status/stage/percent/logs |
| `POST` | `/api/upload/init` | Reserve an upload id |
| `PUT` | `/api/upload/[id]/chunk` | 8 MB chunk (`?offset=` resumes) |
| `POST` | `/api/upload/[id]/complete` | Finalise and queue the job |

### Clips

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/clips/[id]` | Clip, project, transcript words |
| `PATCH` | `/api/clips/[id]` | Rename, save, favourite |
| `POST` | `/api/clips/[id]/render` | Re-render with `{startSec,endSec,subtitleConfig,edits,textOverlay,words?}` |
| `POST` | `/api/clips/[id]/seo` | Regenerate SEO (optionally with the LLM) |
| `POST` | `/api/clips/[id]/thumbnail` | Compose a thumbnail (`{text,fromSec,template}`) |
| `GET` | `/api/clips/[id]/download` | `?format=mp4\|srt\|jpg` (or `?kind=video\|srt\|thumb`) |
| `GET` | `/api/media/[...path]` | Authenticated media streaming (Range supported) |

### Account and admin

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard` | Usage, stats, series, recent projects, queue |
| `GET` | `/api/exports` | Export history |
| `GET` | `/api/billing` | Plans, current usage, invoices |
| `POST` | `/api/billing` | Change plan (self-serve when Stripe is unset) |
| `GET/PATCH` | `/api/settings` | Defaults for aspect, captions, language, music |
| `GET` | `/api/admin/stats` | Users, revenue, jobs, errors |
| `GET` | `/api/admin/users` · `PATCH /api/admin/users/[id]` | List, change plan/role/credits |
| `GET` | `/api/admin/jobs` · `POST /api/admin/jobs/[id]` | Monitor, retry, cancel |
| `GET` | `/api/admin/errors` | Error log |

Errors are `{ error: { code, message } }` with HTTP 400/401/402/403/404/409/429/500. `402`
carries `code: "quota"` or `code: "upgrade"` so the UI can show the right upsell.

---

## Project structure

```
clipwave/
├─ db/migrations/            SQL schema (SQLite + Postgres compatible)
├─ python/                   transcribe.py · audio_features.py · face_track.py
├─ scripts/                  db-init · db-reset · seed · dev-all · setup-fonts
├─ public/                   demo media, generated audio beds
├─ data/                     SQLite file, storage root, outbox (git-ignored)
└─ src/
   ├─ app/
   │  ├─ (auth)/             login · register · forgot-password · reset-password
   │  ├─ dashboard/          overview · new · projects · clips · studio · queue ·
   │  │                      exports · billing · settings · admin
   │  ├─ api/                every endpoint listed above
   │  ├─ layout.tsx  page.tsx  globals.css
   ├─ components/
   │  ├─ marketing/          hero, features, how-it-works, pricing, FAQ, footer …
   │  ├─ dashboard/          shell, charts, project-card, clip-card, admin-dashboard
   │  ├─ studio/             caption preview/editor/controls, SEO panel, clip panels
   │  └─ ui/                 button, card, field, badge, progress, modal, tabs, toast
   ├─ lib/
   │  ├─ ai/                 analyze (scoring), seo, stt, llm
   │  ├─ media/              ffmpeg (render/probe/capture), subtitles (ASS/SRT)
   │  ├─ sources/            YouTube / Kick resolution + yt-dlp acquisition
   │  ├─ pipeline.ts         the whole job
   │  ├─ entitlements.ts     quotas, usage events, plan gating
   │  ├─ plans.ts            plan matrix
   │  ├─ storage.ts          media root + authenticated URLs
   │  ├─ db.ts               SQLite/Postgres driver + migrations
   │  └─ auth*.ts  api.ts  thumbnails.ts  mailer.ts  jobs.ts
   └─ worker/index.ts        queue loop, concurrency, retries, heartbeat
```

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run host` | **One-command local host**: check toolchain → migrate → seed → build → web + worker |
| `npm run dev` | Next dev server on :3000 |
| `npm run worker` | Job worker (separate process) |
| `npm run dev:all` | Both, with prefixed logs |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:init` / `db:reset` / `seed` | Schema + seed data |
| `npm run db:copy [-- --force]` | Copy the local SQLite database into Postgres/Supabase |
| `npm run setup:fonts` | Install Inter/Poppins/Anton/Noto Devanagari |
| `npm run thumbnails:backfill` | Rebuild project posters + 16:9/9:16 clip thumbnails |
| `npm run setup:python` | Create/update the project-local Python venv and install `python/requirements.txt` |

### VS Code

`.vscode/launch.json` and `.vscode/tasks.json` are included:

* **Run & Debug → `Next.js: dev`** starts the web app.
* **`Worker: process jobs`** debugs `src/worker/index.ts` with breakpoints in `pipeline.ts`.
* `Tasks: Run Task → dev:all` runs both in one terminal.

Recommended extensions are listed in `.vscode/extensions.json`.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ffmpeg not found` | Install FFmpeg or set `FFMPEG_PATH` / `FFPROBE_PATH` |
| Job stays `queued` | The worker isn't running — `npm run worker` |
| `Sign in to confirm you're not a bot` | YouTube IP rate-limit: set `YTDLP_COOKIES_FILE` or `YTDLP_PROXY`, or upload the file |
| Transcription is slow | `WHISPER_MODEL=tiny` (CPU) or `WHISPER_DEVICE=cuda` with a GPU |
| Captions show boxes for Hindi/Nepali | `npm run setup:fonts` (needs Noto Sans Devanagari) |
| `no such column: started_at` | Old DB — `npm run db:init` (migration `0002`) |
| 402 `quota` on a new project | Monthly minutes used up — check **Billing**, or top up in **Admin → Users** |
| Portrait clips look soft | The source is upscaled to fill 1080×1920; use a higher-resolution source or export 16:9 |
| Out of memory while rendering | One job at a time: `WORKER_CONCURRENCY=1`, `WHISPER_MODEL=tiny`, render ≤1080p |

Logs: the worker prints one line per stage; per-job detail is in `job_logs` and visible in the
project page ("Activity") and **Admin → Errors**.

---

## Security notes

* Passwords: scrypt with a per-user salt, constant-time comparison.
* Sessions: random 32-byte tokens, httpOnly + `SameSite=Lax` cookies, hashed at rest, 30-day
  expiry, revoked on password change.
* Every project/clip/media query is filtered by the session user id; `/api/media/*` refuses
  paths outside `STORAGE_DIR` and requires ownership.
* Uploads are size-capped (`MAX_UPLOAD_BYTES`) and content-checked with `ffprobe` before use.
* Admin routes check `role === 'admin'` server-side; the page itself redirects non-admins.
* Secrets are only read in server modules (`src/lib/env.ts`); nothing is inlined into the client
  bundle. Copy `.env.example`, never commit `.env.local`.
* Password-reset tokens are single-use, hashed and expire after 30 minutes.

---

## Known limitations

Honest list, because the UI should never lie about what it can do:

* **Viral scores are AI estimates.** They rank moments relative to each other inside one source
  video. They are not a prediction of views and the UI says so.
* **Speaker diarisation is approximate.** Captions support speaker labels from the transcript
  segments, but there is no per-speaker voice model, so two similar voices may be merged.
* **Auto-zoom is a slow push-in**, not a scene-aware Ken-Burns per shot.
* **Background music is a small generated set** (`public/audio/*.mp3`) mixed at 18 % by
  default — add your own beds by dropping `<id>.mp3` into `public/audio/`; the studio lists
  whatever ids `resolveMusic()` (`src/lib/pipeline.ts`) can find.
* **Scene detection** uses shot-boundary heuristics on frames, not a trained model.
* **YouTube/Kick imports depend on `yt-dlp`** and therefore on the platform's goodwill and your
  IP reputation; the upload path always works.
* **No Stripe checkout UI ships enabled** — plan switching is self-serve and admin-adjustable,
  which is the right behaviour for a self-hosted install. Wire `STRIPE_SECRET_KEY` to change it.
* **Single-node by default.** The queue is a database table, so you can run several workers, but
  there is no distributed lock beyond row-level claiming.

---

## License

MIT for the application code. Media in `public/demo` and `public/audio` is generated for this
project; fonts are installed from the system (Inter, Poppins, Anton — OFL; Noto — OFL).
You are responsible for the rights to any content you import.
