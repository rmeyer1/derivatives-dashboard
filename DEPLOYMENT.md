# Derivatives Dashboard Deployment Guide

This guide provides step-by-step instructions for deploying the derivatives dashboard frontend to Vercel.

## Prerequisites

- Node.js installed (version 18 or higher)
- Vercel account and Vercel CLI installed
- Access to the deployed backend API

## Environment Variables

Before deploying, ensure you have the following environment variables configured in Vercel:

- `NEXT_PUBLIC_API_URL` - URL of your deployed backend API (e.g., https://your-backend-url.a.run.app)

## Deployment Steps

### 1. Local Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env.local` file with your backend URL:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. Run development server:
   ```
   npm run dev
   ```

### 2. Vercel Deployment

1. Login to Vercel CLI:
   ```
   vercel login
   ```

2. Deploy to Vercel:
   ```
   vercel
   ```

3. Configure environment variables in Vercel dashboard or using CLI:
   ```
   vercel env add NEXT_PUBLIC_API_URL
   ```

4. For production deployment:
   ```
   vercel --prod
   ```

### 3. GitHub Integration (Optional)

1. Connect your GitHub repository to Vercel
2. Configure automatic deployments on push to main branch
3. Set environment variables in Vercel project settings

## Configuration Files

- `vercel.json` - Contains build configuration and environment variable mappings
- `next.config.js` - Next.js configuration with static export settings
- `.env.production.example` - Example environment variables for production

## Accessing Your Deployed Application

After successful deployment, Vercel will provide you with a URL where your application is accessible. The frontend will communicate with your backend API using the `NEXT_PUBLIC_API_URL` environment variable.