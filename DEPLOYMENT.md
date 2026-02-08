# Deployment Guide - Cloudflare

This guide covers deploying the Laguna Hills HOA Management System to Cloudflare.

## Architecture

- **Backend**: Cloudflare Workers (Hono framework)
- **Frontend**: Cloudflare Pages (Vite + React)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (for document uploads)

## Prerequisites

1. Cloudflare account with Workers/Pages enabled
2. Wrangler CLI installed: `npm install -g wrangler`
3. Domain name (optional, for custom domain)

## Part 1: Deploy Backend (Cloudflare Workers)

### 1. Login to Cloudflare

```bash
wrangler login
```

### 2. Create D1 Database

```bash
# Create the database
wrangler d1 create laguna_hills_hoa

# Copy the database ID from the output
```

### 3. Create R2 Bucket (for document uploads)

```bash
# Enable R2 in your Cloudflare account first
# Then create the bucket
wrangler r2 bucket create hoa-documents
```

### 4. Update wrangler.jsonc

Update `worker/wrangler.jsonc` with your production values:

```jsonc
{
  "name": "laguna-hills-hoa-api",
  "main": "worker/src/index.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "laguna_hills_hoa",
      "database_id": "YOUR_D1_DATABASE_ID_HERE"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "hoa-documents"
    }
  ],
  "vars": {
    "ENVIRONMENT": "production",
    "JWT_SECRET": "CHANGE_ME_TO_A_SECURE_RANDOM_STRING"
  },
  "routes": [
    {
      "pattern": "api.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

**Important:** Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Run Migrations on Production

```bash
cd worker

# Run all migrations in order
wrangler d1 execute laguna_hills_hoa --file=../migrations/0001_schema.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0002_add_lot_ownership.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0003_lot_type_dues_demands.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0004_notifications.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0005_user_names.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0006_household_grouping.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0007_lot_types_labels.sql
wrangler d1 execute laguna_hills_hoa --file=../migrations/0008_pass_management.sql
```

### 6. Seed Initial Users (optional)

Update `scripts/seed-users.ts` to use production D1 binding, then run:
```bash
npx tsx scripts/seed-users.ts
```

Or create admin user manually via the API after deployment.

### 7. Deploy Worker

```bash
cd worker
wrangler deploy
```

Your backend will be deployed to:
```
https://laguna-hills-hoa-api.your-subdomain.workers.dev
```

Note down this URL for the frontend configuration.

## Part 2: Deploy Frontend (Cloudflare Pages)

### Option A: Deploy via Wrangler (Recommended)

#### 1. Create `wrangler.pages.jsonc`

Create `wrangler.pages.jsonc` in the project root:

```jsonc
{
  "name": "laguna-hills-hoa",
  "compatibility_date": "2024-09-23",
  "pages_build_output_dir": "dist",
  "vars": {
    "VITE_API_URL": "https://your-worker.workers.dev/api"
  }
}
```

#### 2. Build for Production

```bash
# From project root
npm run build
```

#### 3. Deploy

```bash
wrangler pages deploy dist --project-name=laguna-hills-hoa
```

### Option B: Deploy via Git Integration

#### 1. Push to GitHub

Ensure your code is on GitHub.

#### 2. Connect in Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Pages
2. Click "Create a project"
3. Select "Connect to Git"
4. Choose your repository
5. Configure build settings:

```
Build command: npm run build
Build output directory: dist
Root directory: /
```

#### 3. Add Environment Variables

In Pages settings, add:
```
VITE_API_URL = https://your-worker.workers.dev/api
```

#### 4. Deploy

Push to main branch to trigger automatic deployment.

## Part 3: Configure Custom Domain (Optional)

### Backend Custom Domain

Update `worker/wrangler.jsonc`:

```jsonc
{
  "routes": [
    {
      "pattern": "api.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ]
}
```

Then redeploy:
```bash
wrangler deploy
```

### Frontend Custom Domain

In Cloudflare Dashboard → Pages → Your project → Custom domains:

Add your domain (e.g., `hoa.yourdomain.com` or `yourdomain.com`)

## Part 4: Post-Deployment Setup

### 1. Update CORS Settings

In `worker/src/index.ts`, ensure CORS includes your production domain:

```typescript
app.use('/*', cors({
  origin: ['https://yourdomain.com', 'https://hoa.yourdomain.com'],
  credentials: true,
}));
```

### 2. Test the Deployment

```bash
# Test backend health
curl https://your-worker.workers.dev/api/health

# Test frontend
open https://your-project.pages.dev
```

### 3. Create Admin User

Register the first admin user via the `/api/auth/register` endpoint or use the seed script.

## Environment Variables Summary

| Variable | Location | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | Worker vars | "production" |
| `JWT_SECRET` | Worker vars | Secure random string |
| `VITE_API_URL` | Pages vars | Backend API URL |

## Troubleshooting

### Worker Deployment Issues

```bash
# Check worker logs
wrangler tail

# View deployed worker info
wrangler deployments list
```

### Pages Deployment Issues

Check the build logs in Cloudflare Dashboard → Pages → Your project → deployments

### Database Connection Issues

Verify D1 binding in wrangler.jsonc matches your created database:
```bash
wrangler d1 list
```

### CORS Errors

Ensure your frontend origin is in the CORS allowlist in `worker/src/index.ts`.

## Security Checklist

- [ ] Changed JWT_SECRET to a secure random value
- [ ] Updated CORS to only allow production domain
- [ ] Added custom domain (avoid .workers.dev in production)
- [ ] Enabled rate limiting on public endpoints
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Regular database backups
- [ ] HTTPS only (automatic with Cloudflare)

## Cost Estimate

As of 2025, free tier includes:
- **Workers**: 100,000 requests/day free
- **Pages**: Unlimited deployments, 500 builds/month free
- **D1**: 5GB storage, 25M reads/day free
- **R2**: 10GB storage, 10M class A operations/month free

For a small HOA (100-500 households), you should stay within free tier limits.

## Monitoring

### Set up Analytics

1. Cloudflare Dashboard → Workers → Your worker → Analytics
2. Cloudflare Dashboard → Pages → Your project → Analytics

### Error Tracking

Consider integrating:
- Sentry (error tracking)
- Logpush (export logs to external service)

## Backup Strategy

### D1 Database Backups

```bash
# Export database
wrangler d1 export laguna_hills_hoa --output=backup.sql

# Import to local for testing
wrangler d1 execute laguna_hills_hoa --local --file=backup.sql
```

### R2 Bucket Backups

R2 has built-in redundancy, but consider:
- Using R2's Object Versioning
- Regular exports to external storage

## Updating the Deployment

### Backend Update

```bash
cd worker
wrangler deploy
```

### Frontend Update

```bash
# From project root
npm run build
wrangler pages deploy dist
```

Or just push to git if using Git integration.

## Support

- Cloudflare Docs: https://developers.cloudflare.com/
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
