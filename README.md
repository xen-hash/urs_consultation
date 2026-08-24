# URS Faculty Consultation System — Deployment Guide
## Railway (Backend) + Vercel (Frontend)

---

## FOLDER STRUCTURE

```
urs-consultation-deploy/
  backend/     → Deploy to Railway
  frontend/    → Deploy to Vercel
```

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
FRONTEND_URL  = https://your-app.vercel.app   ← fill in after Vercel deploy
```

If you previously set `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` / `DB_PORT`,
delete them — `DATABASE_URL` replaces all five.

4. Railway will auto-detect the `Procfile` and run `python app.py`
5. Once deployed, copy your Railway URL: `https://xxx.up.railway.app`

---

## STEP 3: Deploy Frontend on Vercel

1. Push the `frontend/` folder to a GitHub repo
2. Go to https://vercel.com → New Project → Import your repo
3. Set these **Environment Variables** in Vercel:

```
VITE_API_URL  = https://your-railway-app.up.railway.app
```

4. Deploy! Vercel auto-detects Vite and runs `npm run build`
5. Copy your Vercel URL: `https://your-app.vercel.app`

---

## STEP 4: Final Wiring

Go back to Railway → your backend service → Environment Variables:
- Update `FRONTEND_URL` = `https://your-app.vercel.app`
- Redeploy the backend (Railway → Deployments → Redeploy)

---

## NOTES

- **Biometric (Face Recognition)**: Requires the C++ biometric server running locally.
  It will show "Biometric service offline" on the cloud — QR and PIN login still work fine.
- **TTS**: Switched to browser speechSynthesis (no Piper needed on cloud).
- **Local dev**: Still works — `npm run dev` proxies /api to localhost:5000 as before.

---

## LOCAL DEV (unchanged)

Backend:
```
cd backend
pip install -r requirements.txt
python app.py
```

Frontend:
```
cd frontend
npm install
npm run dev
```
