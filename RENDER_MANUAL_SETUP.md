# Manual Render Setup Guide

Since Render might not auto-detect the `render.yaml` configuration, follow these manual setup steps.

## Step 1: Push Code to GitHub

Run the script:
```bash
scripts\push-to-github.bat
```

Or manually:
```bash
git remote remove origin
git remote add origin https://github.com/Jarvis4everyone/newapk.git
git branch -M main
git push -u origin main --force
```

## Step 2: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select repository: **`Jarvis4everyone/newapk`**

## Step 3: Configure Service Settings

### Basic Settings:
- **Name:** `axzora-chat-backend` (or any name you prefer)
- **Region:** Choose closest to you (Oregon recommended)
- **Branch:** `main`
- **Root Directory:** Leave empty (root of repo)

### Build & Deploy Settings:
- **Environment:** Select **"Docker"**
- **Dockerfile Path:** `backend/Dockerfile`
- **Docker Context:** `backend`

**⚠️ IMPORTANT:** These two fields are critical:
- Dockerfile Path: `backend/Dockerfile`
- Docker Context: `backend`

### Plan:
- Select **"Starter"** (Free tier) or upgrade if needed

## Step 4: Set Environment Variables

Go to the **"Environment"** tab and add these variables:

### Copy from your local .env file:

```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
JWT_SECRET=Wh2d2UoLWK1sNgAyiAVNStBEqQEUeIbnEpH1CIxE+FSCdM4q0QIPaNjGeDISL9msCxFPx1QpylvhmEGwa4quuQ==
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=Hd8N4scQhgpH/+PmIvsoUwRFfFK1nrcrWwH0CwDA53WP/NEgF07Tmx46wafXN0gDHrkjku2LzxT9iViMfDspew==
JWT_REFRESH_EXPIRES_IN=30d
POSTGRES_HOST=db.cfzjjpylgbdpfjhurilk.supabase.co
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Shresth123&
POSTGRES_SSL=true
POSTGRES_URL=postgresql://postgres:Shresth123&@db.cfzjjpylgbdpfjhurilk.supabase.co:5432/postgres
MONGO_URI=mongodb+srv://KaushikShresth:Shresth123&@cluster0.awof7.mongodb.net/axzorachat
REDIS_URL=redis://:e18t3KtbWjteqQwPYa1ndmnJZ12KHDWJ@redis-17349.crce178.ap-east-1-1.ec2.redns.redis-cloud.com:17349
AGORA_APP_ID=8cd59413824b417eb60cd6b104d3eb48
AGORA_APP_CERTIFICATE=54c40577db564ab597d6d2412efe03d1
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,mp4,mp3
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**See:** [RENDER_ENV_VARIABLES.md](./RENDER_ENV_VARIABLES.md) for detailed list

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Your service will be available at: `https://your-service-name.onrender.com`

## Step 6: Verify Deployment

1. Check health endpoint:
   ```
   https://your-service-name.onrender.com/health
   ```
   Should return: `{"status":"ok",...}`

2. Check API endpoint:
   ```
   https://your-service-name.onrender.com/api
   ```

## Troubleshooting

### Error: "Dockerfile not found"
- **Solution:** Make sure:
  - Dockerfile Path: `backend/Dockerfile` (not just `Dockerfile`)
  - Docker Context: `backend` (not empty or root)

### Error: "Build failed"
- Check build logs in Render dashboard
- Verify all environment variables are set
- Make sure Dockerfile is correct

### Error: "Database connection failed"
- Verify database credentials in environment variables
- Check if external databases (Supabase, MongoDB Atlas, Redis Cloud) are accessible
- Verify network connectivity

## Quick Reference

**Repository:** https://github.com/Jarvis4everyone/newapk  
**Dockerfile Path:** `backend/Dockerfile`  
**Docker Context:** `backend`  
**Environment:** Docker

## After Deployment

1. Initialize database schema (if needed):
   - Go to Render service → Shell
   - Run: `npm run init:all`

2. Update Flutter app (already done):
   - Production URL: `https://apk-t3gk.onrender.com`
   - File: `lib/config/app_config.dart`

3. Build Android APK:
   ```bash
   flutter build apk --release
   ```

