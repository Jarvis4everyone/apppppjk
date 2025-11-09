# Environment Variables for Render Deployment

Copy these values from your local `.env` file and set them in Render Dashboard.

## ✅ Keep Your Local .env As-Is
Your local `.env` file is perfect for development. **Don't change it.** Just use these same values in Render.

## 🔧 Render Dashboard Environment Variables

Go to your Render service → Environment tab → Add these variables:

### Server Configuration
```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
```
**Note:** Use `*` for CORS_ORIGIN to allow mobile apps (they don't have an origin header)

### JWT Authentication (Copy from your .env)
```
JWT_SECRET=Wh2d2UoLWK1sNgAyiAVNStBEqQEUeIbnEpH1CIxE+FSCdM4q0QIPaNjGeDISL9msCxFPx1QpylvhmEGwa4quuQ==
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=Hd8N4scQhgpH/+PmIvsoUwRFfFK1nrcrWwH0CwDA53WP/NEgF07Tmx46wafXN0gDHrkjku2LzxT9iViMfDspew==
JWT_REFRESH_EXPIRES_IN=30d
```

### PostgreSQL (Supabase) - Copy from your .env
```
POSTGRES_HOST=db.cfzjjpylgbdpfjhurilk.supabase.co
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Shresth123&
POSTGRES_SSL=true
POSTGRES_URL=postgresql://postgres:Shresth123&@db.cfzjjpylgbdpfjhurilk.supabase.co:5432/postgres
```

### MongoDB (Atlas) - Copy from your .env
```
MONGO_HOST=cluster0.awof7.mongodb.net
MONGO_DB=axzorachat
MONGO_USER=KaushikShresth
MONGO_PASSWORD=Shresth123&
MONGO_URI=mongodb+srv://KaushikShresth:Shresth123&@cluster0.awof7.mongodb.net/axzorachat
```

### Redis (Redis Cloud) - Copy from your .env
```
REDIS_HOST=redis-17349.crce178.ap-east-1-1.ec2.redns.redis-cloud.com
REDIS_PORT=17349
REDIS_PASSWORD=e18t3KtbWjteqQwPYa1ndmnJZ12KHDWJ
REDIS_URL=redis://:e18t3KtbWjteqQwPYa1ndmnJZ12KHDWJ@redis-17349.crce178.ap-east-1-1.ec2.redns.redis-cloud.com:17349
```

### Agora Configuration - Copy from your .env
```
AGORA_APP_ID=8cd59413824b417eb60cd6b104d3eb48
AGORA_APP_CERTIFICATE=54c40577db564ab597d6d2412efe03d1
```

### File Upload & Rate Limiting - Copy from your .env
```
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,mp4,mp3
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Socket.IO (Optional - uses CORS_ORIGIN if not set)
```
SOCKET_CORS_ORIGIN=*
```

## 📝 Important Notes

1. **CORS_ORIGIN**: Changed to `*` in Render (allows mobile apps)
2. **NODE_ENV**: Set to `production` in Render
3. **All other values**: Copy exactly from your local `.env`
4. **Database connections**: Your external services (Supabase, MongoDB Atlas, Redis Cloud) will work perfectly - no changes needed!

## 🔒 Security Reminder

- ✅ Your local `.env` is already in `.gitignore` (won't be committed)
- ✅ Set these in Render Dashboard (not in code)
- ✅ Render encrypts environment variables automatically

## 🚀 After Setting Variables

1. Save the environment variables in Render
2. Deploy/Redeploy your service
3. Your backend will connect to all your databases automatically!

