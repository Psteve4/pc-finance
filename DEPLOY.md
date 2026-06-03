# 🚀 P & C Finance — Deployment Guide

## What you're deploying
- React app hosted FREE on Netlify
- Database hosted FREE on Supabase (500MB free tier)
- Total cost: €0/month

---

## STEP 1 — Set up Supabase (database)

1. Go to https://supabase.com and create a free account
2. Click "New Project" — name it "pc-finance", choose a region close to France
3. Set a database password (save it somewhere)
4. Wait ~2 minutes for it to start up
5. In the left sidebar, click **SQL Editor**
6. Click **New Query**
7. Copy the entire contents of `supabase_schema.sql` and paste it in
8. Click **Run** — you should see "Success"
9. Now go to **Settings → API** (left sidebar)
10. Copy two things:
    - **Project URL** (looks like: https://abcdefgh.supabase.co)
    - **anon public** key (long string starting with "eyJ...")

---

## STEP 2 — Put your code on GitHub

1. Go to https://github.com and create a free account if you don't have one
2. Click **New Repository** — name it "pc-finance", make it **Private**
3. Click **Create repository**
4. On your computer, open a terminal in the `financeapp` folder
5. Run these commands:
   ```
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR_USERNAME/pc-finance.git
   git push -u origin main
   ```

---

## STEP 3 — Deploy on Netlify

1. Go to https://netlify.com and create a free account
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** and authorise Netlify
4. Select your `pc-finance` repository
5. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **Show advanced** then **New variable** — add these two:
   - `VITE_SUPABASE_URL` = your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` = your anon key from Step 1
7. Click **Deploy site**
8. Wait ~2 minutes — your app is live at a URL like `https://rainbow-finance-xyz.netlify.app`

---

## STEP 4 — Set a custom URL (optional)

In Netlify → Site settings → Domain management, you can:
- Change the subdomain to something like `pc-finance.netlify.app` (free)
- Add your own domain if you have one

---

## STEP 5 — Change the password

In `src/App.jsx`, line 3:
```js
const PASSWORD = 'canpie2024'
```
Change `canpie2024` to whatever you want, then push to GitHub — Netlify auto-deploys.

---

## Updating the app
Every time you push to GitHub, Netlify automatically rebuilds and redeploys. ~2 minutes.

---

## Wise API Setup (optional — for live balances)

1. Log in to Wise → Settings → API tokens
2. Create a **Read-only** token
3. Add it as `VITE_WISE_TOKEN` in Netlify environment variables
4. Note: Wise's sandbox/personal API gives balances per profile
   Full integration requires a follow-up code update

---

## Troubleshooting

**App shows blank page**: Check browser console (F12) for errors — usually a missing env variable
**Supabase errors**: Double-check your URL and anon key in Netlify env vars
**Build fails**: Check that all files from this folder are committed to GitHub
