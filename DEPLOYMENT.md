# Deployment Guide - Derivatives Dashboard Frontend

## Overview
Next.js 14 app deployed on Vercel.

## Prerequisites
- Vercel account (vercel.com)
- Vercel CLI installed: `npm i -g vercel`
- Backend deployed and URL known

## Environment Variables

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Vercel Dashboard → Project Settings → Environment Variables |

Example values:
- Development: `http://localhost:8000`
- Production: `https://derivatives-backend-xyz123-ue.a.run.app`

## Deployment Steps

### Option 1: Vercel Dashboard (Recommended)

1. **Push code to GitHub**
   ```bash
   git add -A
   git commit -m "Add deployment configs"
   git push origin master
   ```

2. **Import project in Vercel**
   - Go to https://vercel.com/new
   - Import `rmeyer1/derivatives-dashboard`
   - Framework preset: Next.js
   - Root directory: `./` (default)
   - Build command: `npm run build` (default)

3. **Add Environment Variable**
   - In project settings, add:
     - Name: `NEXT_PUBLIC_API_URL`
     - Value: Your Cloud Run URL (e.g., `https://derivatives-backend-xyz123-ue.a.run.app`)

4. **Deploy**
   - Vercel will auto-build and deploy
   - Get your URL: `https://derivatives-dashboard-xyz.vercel.app`

### Option 2: Vercel CLI

```bash
# Login
vercel login

# Deploy (from project root)
cd derivatives-dashboard
vercel --prod

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL
# Enter your backend URL when prompted

# Redeploy with new env var
vercel --prod
```

## Post-Deployment Checklist

- [ ] Frontend loads without errors
- [ ] Tab "Portfolio" shows data from backend
- [ ] Tab "Charts" displays per-ticker DMA/IV charts
- [ ] Tab "Alerts" shows IV spike notifications
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows successful API calls to backend

## Updating CORS on Backend

After deploying frontend, update backend CORS:

```bash
# Get your Vercel URL
VERCEL_URL="https://derivatives-dashboard-xyz.vercel.app"

# Update Cloud Run service
gcloud run services update derivatives-backend \
  --region us-east1 \
  --set-env-vars "CORS_ORIGINS=${VERCEL_URL},http://localhost:3000"
```

## Custom Domain (Optional)

1. In Vercel dashboard: Project → Settings → Domains
2. Add your domain (e.g., `dashboard.yourdomain.com`)
3. Follow DNS configuration instructions
4. Update backend CORS with new domain

## Troubleshooting

**Build fails**: Check `package.json` has correct build script

**API calls failing**: Verify `NEXT_PUBLIC_API_URL` is set in Vercel

**CORS errors**: Update backend `CORS_ORIGINS` env var with Vercel domain

**Charts not loading**: Check browser console for errors, verify backend health

## Git Integration

Vercel auto-deploys on push to master:
1. Push changes to GitHub
2. Vercel triggers new build
3. Site updates automatically

## Performance

- Static assets cached at edge
- API calls go directly to backend
- Dashboard loads < 2s typical
