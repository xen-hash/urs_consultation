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

## STEP 1: Deploy MySQL on Railway

1. Go to https://railway.app → New Project → Add MySQL
2. Click the MySQL service → **Variables** tab
3. Copy: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT`
4. Open **Query** tab and run your DB schema SQL to create tables

---

## STEP 2: Deploy Backend on Railway

1. Push the `backend/` folder to a GitHub repo (or use Railway CLI)
2. Railway → New Service → Deploy from GitHub → select your repo
3. Set these **Environment Variables** in Railway:

```
DB_HOST       = (from MySQL service MYSQL_HOST)
DB_USER       = (from MySQL service MYSQL_USER)
DB_PASS       = (from MySQL service MYSQL_PASSWORD)
DB_NAME       = consultation_system
DB_PORT       = (from MySQL service MYSQL_PORT)
SECRET_KEY    = (generate a random string, e.g. openssl rand -hex 32)
FRONTEND_URL  = https://your-app.vercel.app   ← fill in after Vercel deploy
```

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
