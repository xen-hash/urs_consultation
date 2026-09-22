# URS Faculty Consultation System — Deployment Guide
## Railway (Backend) + Vercel (three Frontends)

---

## FOLDER STRUCTURE

```
urs-consultation-deploy/
  backend/               → Deploy to Railway
  frontend/              → One npm workspace, three Vercel projects
    shared/              → Everything the three apps have in common
    apps/student/        → Vercel project 1 — public + students
    apps/faculty/        → Vercel project 2 — staff only
    apps/admin/          → Vercel project 3 — staff only
```

The three roles are three separate deployments on three origins, so nothing an
administrator can do ships in the bundle a student downloads. Each app owns its
whole origin:

| App | Screens |
|---|---|
| student | `/` front page · `/availability` · `/sign-in` · `/register` · `/dashboard` |
| faculty | `/` sign-in · `/dashboard` |
| admin | `/` sign-in · `/dashboard` |

The old shared addresses (`/student/dashboard`, `/teacher`, `/dean`, `/kiosk`
and the rest) still redirect to the right screen on the right app, so printed
QR cards and bookmarks keep working.

---

## STEP 1: Create a free PostgreSQL database

The backend runs on PostgreSQL. Use a provider whose free tier doesn't expire:

1. Go to https://neon.tech → sign up → **Create project**
2. Pick the region closest to you (Singapore is nearest the Philippines)
3. Copy the **Connection string** from the dashboard — it looks like
   `postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

https://supabase.com works too: Settings → Database → Connection string → URI.

You do **not** need to run any schema SQL — the app creates its own tables and
seeds the professor list the first time it starts.

> Full setup and troubleshooting: **MIGRATION_POSTGRES.md**.
> Starting fresh is fine — migrating old MySQL data is an optional extra step there.

---

## STEP 2: Deploy Backend on Railway

1. Push the `backend/` folder to a GitHub repo (or use Railway CLI)
2. Railway → New Service → Deploy from GitHub → select your repo
3. Set these **Environment Variables** in Railway:

```
DATABASE_URL  = (the Postgres connection string from STEP 1)
SECRET_KEY    = (generate a random string, e.g. openssl rand -hex 32)
ADMIN_USERNAME      = (who signs in on the admin app)
ADMIN_PASSWORD_HASH = (bcrypt hash — see README_DEPLOY.md Step 0)
ALLOWED_ORIGINS = https://student.vercel.app,https://faculty.vercel.app,https://admin.vercel.app
                  ← all three, filled in after the Vercel deploys
```

If you previously set `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` / `DB_PORT`,
delete them — `DATABASE_URL` replaces all five.

4. Railway will auto-detect the `Procfile` and run `python app.py`
5. Once deployed, copy your Railway URL: `https://xxx.up.railway.app`

---

## STEP 3: Deploy the three frontends on Vercel

One repo, three Vercel projects, differing only in **Root Directory**. For each
of `student`, `faculty` and `admin`:

1. https://vercel.com → New Project → Import your repo (the same repo each time)
2. **Root Directory** → `frontend/apps/student` (then `.../faculty`, `.../admin`)
3. Leave the build settings alone — each app's `vercel.json` sets them. The
   install runs at `frontend/`, the npm workspace root; running it inside the
   app folder would leave `@urs/shared` unresolved and fail the build.
4. Deploy, and copy the URL.

Then give **every one of the three projects** all four variables:

```
VITE_API_BASE    = https://your-railway-app.up.railway.app/api
VITE_STUDENT_URL = https://your-student-app.vercel.app
VITE_FACULTY_URL = https://your-faculty-app.vercel.app
VITE_ADMIN_URL   = https://your-admin-app.vercel.app
```

Each app links to the other two, and can only do it if it has been told where
they are. Unset, those links fall back to the development ports and quietly
point at `localhost`. Redeploy after setting them — they are baked in at build
time, not read at runtime.

---

## STEP 4: Final Wiring

Go back to Railway → your backend service → Environment Variables:
- Set `ALLOWED_ORIGINS` to all three Vercel URLs, comma-separated, exact
  (scheme and host, no trailing slash)
- Redeploy the backend (Railway → Deployments → Redeploy)

---

## INSTALLING IT AS AN APP (PWA)

The frontend is a Progressive Web App, so students and faculty can install it
instead of visiting a URL — it gets its own icon, opens without browser tabs or
an address bar, and keeps working when the campus WiFi drops.

**Android / Chrome / Edge** — open the site and tap the **Install App** button in
the top bar (or the browser's "Install" prompt).
**iPhone / iPad (Safari)** — tap **Install App**, then Share → Add to Home Screen.
**Desktop Chrome / Edge** — click the install icon in the address bar.

Once installed:

- There are three installable apps, one per role, each with its own name and
  its own colour. Installing the student app does not put the administration
  screens on anybody's phone.
- Long-pressing an icon opens that app's own shortcuts — **Who's available**,
  **My dashboard** and **Register** on the student app; **My requests** and
  **Status & schedule** on faculty; **Credentials** and **Activity log** on
  administration.
- The app shell (pages, styles, logo) is cached, so it still opens with no
  connection — an amber bar says *"You're offline"* and live data resumes on
  reconnect.
- Consultation data is never served from cache. Faculty status, requests, and
  schedules always come from the backend so nothing shows stale availability.
- After a redeploy, open tabs and installed home-screen apps pick the new
  version up on their own — nobody has to reload, reinstall, or be told to.
  The app asks whether there is a new build every 15 minutes, every time it
  comes back to the foreground, and whenever the connection returns; the last
  two are what matter on a phone, where a backgrounded app's timers are frozen.
- The one thing that delays a reload is somebody typing. If a field has text in
  it, the update waits and says *"An update is ready — it will load when you
  finish typing"*, with a **Reload now** button for anyone who would rather not
  wait. It goes ahead by itself the moment the field is empty, loses focus, or
  the app is put into the background.

Requirements: the site must be served over **HTTPS** (Vercel already is) — the
service worker, camera-based face login, and install prompt all need it.
Nothing extra to configure: each app's build generates its own service worker
and manifest, scoped to its own origin — which is what lets all three be
installed side by side without the browser treating them as one app.

---

## NOTES

- **Biometric (Face Recognition)**: Requires the C++ biometric server running locally.
  It will show "Biometric service offline" on the cloud — QR and PIN login still work fine.
- **TTS**: Switched to browser speechSynthesis (no Piper needed on cloud).
- **Local dev**: Each app's dev server proxies /api to localhost:5000 as before.
- **`npm run build` at `frontend/`** builds all three apps; `build:student`,
  `build:faculty` and `build:admin` build one.

---

## LOCAL DEV

Backend:
```
cd backend
pip install -r requirements.txt
python app.py
```

Frontend — one install at the workspace root, then a terminal per app:
```
cd frontend
npm install

npm run dev:student   # http://localhost:5173  (front page, board, students)
npm run dev:faculty   # http://localhost:5174
npm run dev:admin     # http://localhost:5175
```

The ports are fixed, and the links between the apps default to them, so the
three of them work together with no environment set up at all. Running one app
on its own is fine — its own screens all work; only the links to the other two
need those apps to be up.

`npm test` and `npm run lint` at `frontend/` cover all three apps and the shared
code in one run. `npm run build` builds all three.
