# Fix "Dockerfile not found" Error

## Problem
Render is looking for `Dockerfile` in the root directory, but it's actually at `backend/Dockerfile`.

## Solution: Update Render Dashboard Settings

### Step 1: Go to Your Service Settings

1. Go to https://dashboard.render.com
2. Click on your service: **apk** (or the service name)
3. Click on **"Settings"** tab (in the left sidebar)

### Step 2: Find "Build & Deploy" Section

Scroll down to the **"Build & Deploy"** section.

### Step 3: Update These Two Fields

Look for these settings and update them:

#### Field 1: Dockerfile Path
- **Current (wrong):** `Dockerfile` or empty
- **Change to:** `backend/Dockerfile`
- **Location:** In the "Build & Deploy" section, look for "Dockerfile Path" or "Dockerfile" field

#### Field 2: Docker Context
- **Current (wrong):** Empty or `.` or root
- **Change to:** `backend`
- **Location:** In the "Build & Deploy" section, look for "Docker Context" or "Context" field

### Step 4: Save and Redeploy

1. Click **"Save Changes"** at the bottom
2. Go to **"Manual Deploy"** tab
3. Click **"Deploy latest commit"** or **"Clear build cache & deploy"**

## Visual Guide

```
Render Dashboard → Your Service → Settings → Build & Deploy

┌─────────────────────────────────────────┐
│ Build & Deploy                           │
├─────────────────────────────────────────┤
│ Environment: Docker                      │
│                                          │
│ Dockerfile Path: [backend/Dockerfile]   │ ← Change this
│                                          │
│ Docker Context: [backend]                │ ← Change this
│                                          │
│ Root Directory: [leave empty]            │
└─────────────────────────────────────────┘
```

## Alternative: If You Don't See These Fields

If you don't see "Dockerfile Path" and "Docker Context" fields:

1. Go to **Settings** tab
2. Look for **"Environment"** dropdown
3. Make sure it's set to **"Docker"** (not "Node" or "Nixpacks")
4. After selecting "Docker", the Dockerfile fields should appear

## Quick Fix Commands (If You Have Shell Access)

If Render provides shell access, you can verify the structure:

```bash
# Check if Dockerfile exists
ls -la backend/Dockerfile

# Should show: backend/Dockerfile
```

## Verify Your Repository Structure

Your repository should have this structure:
```
newapk/
├── backend/
│   ├── Dockerfile          ← Dockerfile is here
│   ├── package.json
│   └── src/
├── lib/
├── android/
└── render.yaml
```

## After Fixing

1. Save the settings
2. Trigger a new deployment
3. Watch the build logs - it should now find the Dockerfile
4. Build should proceed successfully

## Still Having Issues?

1. **Check render.yaml** - Make sure it has:
   ```yaml
   dockerfilePath: ./backend/Dockerfile
   dockerContext: ./backend
   ```

2. **Try clearing build cache:**
   - Settings → Clear build cache
   - Then redeploy

3. **Verify repository:**
   - Make sure `backend/Dockerfile` exists in your GitHub repo
   - Check: https://github.com/Jarvis4everyone/newapk/tree/main/backend

