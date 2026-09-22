# URS Consultation System — Deployment Guide
## Render (Backend) + Vercel (Frontend) + UptimeRobot (Keep-Alive)

---

## FOLDER STRUCTURE
```
deploy/
├── backend/            ← Deploy this to Render
└── frontend/           ← One npm workspace, three Vercel projects
    ├── shared/         ← Everything the three apps have in common
    └── apps/
        ├── student/    ← Vercel project 1 — public + students
        ├── faculty/    ← Vercel project 2 — staff only
        └── admin/      ← Vercel project 3 — staff only
```

The three roles are three separate deployments on three origins. Nothing an
administrator can do is in the bundle a student downloads, and an app can be
taken down, rolled back or restricted without touching the other two.

Each app owns its whole origin, so its screens sit at the root:

| App | Screens |
|---|---|
| student | `/` front page · `/availability` · `/sign-in` · `/register` · `/dashboard` |
| faculty | `/` sign-in · `/dashboard` |
| admin | `/` sign-in · `/dashboard` |

The student app carries the front page and the availability board as well,
because the board needs no account and is the most common reason anybody opens
the system at all.

The old shared addresses — `/student`, `/student/dashboard`, `/teacher`,
`/teacher/dashboard`, `/dean`, `/dean/dashboard`, `/kiosk` — still redirect to
their new homes on the right app, hash and all, so printed QR cards and
bookmarks keep working.

---

## STEP 0 — Security settings you must set before going live

The backend **refuses to start** if `SECRET_KEY`, the administrator password or
`KIOSK_PASSWORD` still hold their built-in development defaults. That is
deliberate: those values are visible in the source, so a deployment carrying one
has no authentication at all. Generate real ones:

```bash
# Signs session tokens. Anyone who knows it can forge a session for any role.
python -c "import secrets; print(secrets.token_urlsafe(48))"

# Administrator password, as a bcrypt hash so the plaintext is never stored.
python -c "import bcrypt; print(bcrypt.hashpw(b'YOUR-PASSWORD', bcrypt.gensalt()).decode())"
```

Set these in the host's environment (Render → Environment):

| Variable | Value |
|---|---|
| `SECRET_KEY` | the random string from above |
| `ADMIN_USERNAME` | who signs in on the admin app |
| `ADMIN_PASSWORD_HASH` | the bcrypt hash from above |
| `KIOSK_PASSWORD` | exit code for the public kiosk display |
| `ALLOWED_ORIGINS` | all three frontend URLs, comma-separated, never `*` |

For local development only, `ALLOW_INSECURE_DEFAULTS=1` lets the built-in
defaults through. Never set it on a deployed instance.

---

## STEP 0b — First run: issue faculty ID cards

Faculty sign in by scanning a Faculty ID card, or with their Employee ID and a
PIN. **Cards are issued by an administrator** — there is no self-service path,
because the one that used to exist handed any visitor any professor's login
credential.

After the first deploy:

1. Sign in at `/dean` with the administrator credentials from Step 0.
2. Open **Credentials**.
3. For each faculty member, choose **Issue card**. The QR is displayed once —
   print or download it there and then. It cannot be retrieved afterwards.
4. Hand the printed card over. On first scan they are asked to set a PIN.

**Upgrading an existing installation:** every faculty QR printed before this
release stops working, because the old cards encoded the employee ID (a
guessable value) rather than a random credential. Anyone who already set a PIN
can still sign in with Employee ID + PIN while cards are reissued, so nobody is
locked out — but tell faculty before the switch.

If a card is lost, **Reissue** replaces it and revokes the old one in the same
action. **Revoke** kills a card without issuing a replacement, and
**Deactivate** blocks the account and revokes the card together.

---

## STEP 1 — Set up a PostgreSQL Database

The backend runs on PostgreSQL. Free options whose free tier doesn't expire:

| Option | Link |
|---|---|
| **Neon** (recommended) | https://neon.tech |
| **Supabase** | https://supabase.com |
| **Render Postgres** | free for 30 days, then paid |

Copy the **connection string** it gives you — one value, used in Step 2:

```
postgresql://user:password@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

> Full setup and troubleshooting: **MIGRATION_POSTGRES.md**.
> Starting fresh is fine — migrating old MySQL data is an optional extra step there.

---

## STEP 2 — Deploy Backend to Render

**The short way — Blueprint.** `render.yaml` at the repository root describes
the service, so Render can create it for you:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/xen-hash/urs_consultation)

That button lands on Render's Blueprint form with this repository already
filled in. The equivalent by hand is https://render.com → **New → Blueprint**
→ connect this repo. It sets the runtime, the build and start
commands, the health check and `rootDir: backend`, generates `SECRET_KEY`
itself, and then asks you for the four values it deliberately does not store —
`DATABASE_URL`, `ALLOWED_ORIGINS`, `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`.
Skip to step 5 for what those are.

(The file used to live in `backend/`, where Render never looked for it — it
reads `render.yaml` from the repository root and nowhere else.)

**The manual way**, if you would rather click through it:

1. Go to https://render.com → **New → Web Service**
2. Connect this GitHub repo
3. Set **Root Directory** to `backend`
4. Render auto-detects Python. Confirm these settings:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class gevent -w 1 --timeout 120 --bind 0.0.0.0:$PORT app:app`
   - **Health Check Path:** `/api/health` — without it, a deploy that fails to
     boot is still marked live, and the app now refuses to boot on default
     secrets
5. Go to your service → **Environment** tab → add:

```
DATABASE_URL        = (the Postgres connection string from Step 1)
SECRET_KEY          = (the random string from Step 0)
ALLOWED_ORIGINS     = https://a.vercel.app,https://b.vercel.app,https://c.vercel.app
                      ← all three, updated after Step 3
ADMIN_USERNAME      = (who signs in on the admin app)
ADMIN_PASSWORD_HASH = (the bcrypt hash from Step 0)
KIOSK_PASSWORD      = (the kiosk exit code from Step 0)
```

The deploy will fail to boot if `SECRET_KEY`, the admin password or
`KIOSK_PASSWORD` are left at their built-in defaults — see Step 0.

`DATABASE_URL` replaces the old `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` /
`DB_PORT` set; delete those if they're still there.

6. Click **Deploy** → copy your Render backend URL (e.g. `https://urs-backend.onrender.com`)

---

## STEP 3 — Deploy the three frontends to Vercel

One repo, three Vercel projects, all pointing at the same GitHub repo and
differing only in **Root Directory**.

For each of `student`, `faculty` and `admin`:

1. https://vercel.com → **New Project → Import GitHub repo** (the same repo all
   three times)
2. **Root Directory** → `frontend/apps/student` (then `.../faculty`, `.../admin`)
3. Leave **Build Command**, **Install Command** and **Output Directory** alone —
   each app's `vercel.json` sets them. The install runs at `frontend/`, which is
   the npm workspace root; installing inside the app folder instead would leave
   `@urs/shared` unresolved and the build would fail on the first import.
4. Deploy, and copy the URL it gives you.

Do all three, then come back and give each project the four variables below
(**Settings → Environment Variables**):

```
VITE_API_BASE    = https://your-backend.onrender.com/api
VITE_STUDENT_URL = https://your-student-app.vercel.app
VITE_FACULTY_URL = https://your-faculty-app.vercel.app
VITE_ADMIN_URL   = https://your-admin-app.vercel.app
```

**All four go on all three projects.** Each app links to the other two — the
cards on the front page, the "in the wrong place?" row under every sign-in, and
every answer Navi gives about a screen it does not itself serve — and it can
only do that if it has been told where they are. Unset, those links fall back to
the development ports and point at `localhost`, which renders as a perfectly
normal link that does nothing. The app says so in the browser console when it
notices, but nothing fails a build.

Redeploy each project after setting them: these are baked in at build time, not
read at runtime.

Socket.IO connects to the origin of `VITE_API_BASE`, so there is no second
variable to keep in step — set `VITE_SOCKET_URL` only if the websocket genuinely
lives on a different host.

A value set here overrides the committed `frontend/.env.production` (shared by
all three builds), and it does so per-variable rather than wholesale. Each app's
`vercel.json` already carries the security headers, SPA rewrite and cache rules;
you should not need to change them.

> **Custom domains.** Subdomains of one domain are the tidiest arrangement —
> `consultation.example.edu`, `faculty.consultation.example.edu`,
> `admin.consultation.example.edu` — with the student app on the apex, since it
> is the one the public is given.

---

## STEP 4 — Update ALLOWED_ORIGINS on Render

Go back to Render → your backend service → **Environment** → update:
```
ALLOWED_ORIGINS = https://student.vercel.app,https://faculty.vercel.app,https://admin.vercel.app
```
Then click **Manual Deploy → Deploy latest commit** to redeploy.

**All three origins, comma-separated.** Each has to be exact — scheme and host,
no trailing slash and no path. It no longer defaults to `*`, so getting one
wrong means that app's browser blocks every API call with a CORS error while the
backend itself looks healthy, and the other two keep working — which makes it
look like a problem with one app rather than one line of configuration.
Add Vercel preview URLs as extra comma-separated entries if you use them.

**If the deploy fails to start**, check the Render logs for a `RuntimeError`
naming `SECRET_KEY`, `ADMIN_PASSWORD` or `KIOSK_PASSWORD`. The app refuses to
boot while any of them still holds a built-in default — see Step 0. The health
check at `/api/health` means Render will report that deploy as failed rather
than quietly marking it live.

---

## STEP 5 — Initialize the Database

Once your Render backend is live, visit:
```
https://your-backend.onrender.com/api/health
```
This triggers `init_db()` on first start, which creates every table and seeds
the professor list. No manual SQL needed.

---

## STEP 6 — Set Up UptimeRobot (Keep-Alive)

> ⚠️ Render's free tier **spins down** after 15 minutes of inactivity.
> UptimeRobot pings your backend every 5 minutes to keep it awake 24/7.

1. Go to https://uptimerobot.com → Register for free
2. Click **+ Add New Monitor**
3. Fill in:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `URS Backend`
   - **URL:** `https://your-backend.onrender.com/api/health`
   - **Monitoring Interval:** `Every 5 minutes`
4. Click **Create Monitor** — done!

UptimeRobot will now ping your backend every 5 minutes so it never sleeps.

---

## NOTES

- **Biometric (face recognition)** — The C++ biometric server cannot run on Render.
  It will return 503 gracefully. Keep the kiosk PC running the local C++ server
  for on-site biometric login only.

- **TTS (Text-to-Speech)** — Piper TTS is replaced with the browser's built-in
  `window.speechSynthesis` API. It works on Chrome/Edge automatically online.

- **QR codes** — Generated QR codes are stored in `backend/static/qrcodes/`.
  On Render these reset on redeploy. For permanent QR storage, consider
  adding an S3/Cloudflare R2 bucket later.

---

## LOCAL DEV (on your original PC)

Everything still works locally as before:
```bash
# Backend
cd backend && python app.py

# Frontend
cd frontend && npm install && npm run dev
```
The dev proxy in `vite_config.js` points to `localhost:5000` automatically.
