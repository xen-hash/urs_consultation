# URS Consultation System — Deployment Guide
## Render (Backend) + Vercel (Frontend) + UptimeRobot (Keep-Alive)

---

## FOLDER STRUCTURE
```
deploy/
├── backend/   ← Deploy this to Render
└── frontend/  ← Deploy this to Vercel
```

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
| `ADMIN_USERNAME` | who signs in at `/dean` |
| `ADMIN_PASSWORD_HASH` | the bcrypt hash from above |
| `KIOSK_PASSWORD` | exit code for the public kiosk display |
| `ALLOWED_ORIGINS` | your frontend URL — comma-separated, never `*` |

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

1. Push the `backend/` folder to its own GitHub repo
2. Go to https://render.com → **New → Web Service**
3. Connect your GitHub repo
4. Render auto-detects Python. Confirm these settings:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class gevent -w 1 --timeout 120 --bind 0.0.0.0:$PORT app:app`
5. Go to your service → **Environment** tab → add:

```
DATABASE_URL        = (the Postgres connection string from Step 1)
SECRET_KEY          = (the random string from Step 0)
ALLOWED_ORIGINS     = https://your-app.vercel.app   ← update after Step 3
ADMIN_USERNAME      = (who signs in at /dean)
ADMIN_PASSWORD_HASH = (the bcrypt hash from Step 0)
KIOSK_PASSWORD      = (the kiosk exit code from Step 0)
```

The deploy will fail to boot if `SECRET_KEY`, the admin password or
`KIOSK_PASSWORD` are left at their built-in defaults — see Step 0.

`DATABASE_URL` replaces the old `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` /
`DB_PORT` set; delete those if they're still there.

6. Click **Deploy** → copy your Render backend URL (e.g. `https://urs-backend.onrender.com`)

---

## STEP 3 — Deploy Frontend to Vercel

1. Push the `frontend/` folder to its own GitHub repo
2. Go to https://vercel.com → **New Project → Import GitHub repo**
3. In Vercel project settings → **Environment Variables** → add:

```
VITE_API_BASE   = https://your-backend.onrender.com/api
VITE_SOCKET_URL = https://your-backend.onrender.com
```

4. Deploy → copy your Vercel URL (e.g. `https://urs-consultation.vercel.app`)

---

## STEP 4 — Update ALLOWED_ORIGINS on Render

Go back to Render → your backend service → **Environment** → update:
```
ALLOWED_ORIGINS = https://urs-consultation.vercel.app
```
Then click **Manual Deploy → Deploy latest commit** to redeploy.

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
