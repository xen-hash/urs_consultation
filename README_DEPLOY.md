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

## STEP 1 — Set up a MySQL Database

Render does **not** offer a free MySQL service. Use one of these free external options:

| Option | Link |
|---|---|
| **Aiven** (recommended) | https://aiven.io |
| **FreeSQLDatabase** | https://www.freesqldatabase.com |
| **PlanetScale** | https://planetscale.com |

After setup, copy your **host**, **user**, **password**, **database name**, and **port** — you'll need them in Step 2.

---

## STEP 2 — Deploy Backend to Render

1. Push the `backend/` folder to its own GitHub repo
2. Go to https://render.com → **New → Web Service**
3. Connect your GitHub repo
4. Render auto-detects Python. Confirm these settings:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app`
5. Go to your service → **Environment** tab → add:

```
DB_HOST         = (your MySQL host)
DB_USER         = (your MySQL user)
DB_PASS         = (your MySQL password)
DB_NAME         = consultation_system
DB_PORT         = 3306
SECRET_KEY      = (make a long random string)
ALLOWED_ORIGINS = https://your-app.vercel.app   ← update after Step 3
KIOSK_PASSWORD  = admin123
ADMIN_PASSWORD  = admin123
```

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
This triggers `init_db()` on first start which creates all tables.

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
