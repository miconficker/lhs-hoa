# CI/CD Automation Documentation

This document describes the automated deployment scripts implemented for the Laguna Hills HOA Management System.

## Overview

The project uses GitHub Actions for continuous integration and deployment to Cloudflare Pages and Workers. The CI/CD pipeline automates testing, building, and deployment processes.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Trigger:** Push to `main` or `develop` branches, and pull requests

**Jobs:**
- **Test and Lint**: Runs linter, TypeScript type check, tests, and builds production bundle
- **Validate Environment**: Validates environment configuration

**Steps:**
1. Checkout code
2. Setup Node.js v20
3. Install dependencies (`npm ci`)
4. Run linter (`npm run lint`)
5. TypeScript type check (`npx tsc --noEmit`)
6. Run tests (`npm run test`)
7. Build production bundle (`npm run build`)
8. Validate environment configuration (`npm run validate-env`)

### 2. Deploy Preview Workflow (`.github/workflows/deploy-preview.yml`)

**Trigger:** Pull requests to `main` branch

**Jobs:**
- **Deploy to Cloudflare Pages Preview**: Deploys preview URL for PR testing

**Steps:**
1. Checkout code
2. Setup Node.js v20
3. Install dependencies
4. Run tests
5. Build with preview API URL
6. Deploy to Cloudflare Pages preview environment
7. Comment PR with preview URL

**Preview URL Format:**
```
https://deploy-preview-{PR_NUMBER}-laguna-hills-hoa.pages.dev
```

### 3. Deploy Production Workflow (`.github/workflows/deploy-production.yml`)

**Trigger:** Push to `main` branch or manual workflow dispatch

**Jobs:**

#### validate
- Confirms manual deployment when triggered via workflow_dispatch
- Requires typing "production" to confirm

#### test
- Runs all quality checks (lint, TypeScript, tests, environment validation)
- Builds production bundle with production API URL
- Must pass before deployment proceeds

#### deploy
- Deploys frontend to Cloudflare Pages production
- Uses GitHub environment for approval and URL tracking
- Creates deployment summary with commit info

#### deploy-worker
- Deploys backend Cloudflare Worker using wrangler
- Installs wrangler CLI and deploys worker configuration
- Notes that database migrations should be run manually

#### smoke-tests
- Waits 30 seconds for deployment to propagate
- Tests frontend health (returns 2xx status)
- Tests backend API health endpoint
- Creates summary of test results

#### notify
- Reports final deployment status (success or failure)
- Creates GitHub summary with deployment details
- Fails workflow if deployment was unsuccessful

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages and Workers permissions | `abc123...` |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | `f7542e2f-7602-41d9-87a5-e2670dc1853e` |
| `PRODUCTION_URL` | Production frontend URL for health checks | `https://lhs-hoa.pages.dev` |
| `PRODUCTION_API_URL` | Production backend API URL for health checks | `https://lhs-hoa-api.workers.dev/api` |
| `PREVIEW_API_URL` | Backend API URL for preview deployments | `https://preview-api.workers.dev/api` |

### Creating Cloudflare API Token

1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create token with permissions:
   - Account - Cloudflare Pages: Edit
   - Account - Workers Scripts: Edit
   - Account - Account Settings: Read

## Deployment Process

### Automatic Deployment (On Push to Main)

1. Developer pushes to `main` branch
2. CI workflow runs tests and quality checks
3. If all tests pass, production deployment triggers
4. Workflow runs full test suite
5. Deploys frontend to Cloudflare Pages
6. Deploys backend worker to Cloudflare Workers
7. Runs smoke tests against production URLs
8. Reports deployment status

### Manual Deployment

1. Go to Actions tab in GitHub
2. Select "Deploy Production" workflow
3. Click "Run workflow"
4. Type "production" to confirm
5. Click "Run workflow" button

### Preview Deployment

1. Create pull request to `main`
2. Workflow automatically deploys preview
3. Preview URL is commented on PR
4. Preview updates automatically as PR is modified

## Database Migrations

**Important:** Database migrations are NOT automatically run in production to prevent accidental data loss.

### Running Migrations Manually

When deploying schema changes:

```bash
# List available migrations
ls migrations/

# Run a specific migration on production
wrangler d1 execute laguna_hills_hoa --file=migrations/0001_schema.sql --remote

# Verify migration
wrangler d1 execute laguna_hills_hoa --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

## Environment Configuration

### Production Environment

The production deployment uses environment variables defined in `wrangler.jsonc`:
- `ENVIRONMENT`: "production"
- `ALLOWED_ORIGINS`: Production frontend URL
- `GOOGLE_REDIRECT_URI`: Production OAuth callback URL

Secrets (JWT_SECRET, Google OAuth credentials) are stored in Cloudflare Workers dashboard.

### Preview Environment

Preview deployments use:
- `VITE_API_URL`: Set via GitHub Secret `PREVIEW_API_URL`
- Backend API should point to staging/preview backend

## Monitoring and Troubleshooting

### Viewing Deployment Status

1. Go to Actions tab in GitHub repository
2. Select the workflow run
3. View logs for each job
4. Check deployment summaries

### Common Issues

**Build Failures:**
- Check TypeScript errors in CI logs
- Verify all dependencies are installed
- Check environment variable validation

**Deployment Failures:**
- Verify Cloudflare API token has correct permissions
- Check account ID matches your Cloudflare account
- Ensure project name matches Cloudflare Pages project

**Smoke Test Failures:**
- Check if production URL secret is set
- Verify DNS propagation (can take 5-10 minutes)
- Check Cloudflare Pages deployment logs

**Worker Deployment Failures:**
- Verify wrangler.jsonc configuration
- Check D1 database bindings
- Ensure R2 bucket exists

## Rollback Procedure

If a deployment causes issues:

### Option 1: Revert Commit
```bash
git revert <commit-hash>
git push origin main
```

### Option 2: Manual Rollback
```bash
# Redeploy previous version manually
wrangler pages deploy dist --project-name=lhs-hoa
```

### Option 3: Cloudflare Dashboard
1. Go to Cloudflare Dashboard → Pages
2. Select project
3. Deployments tab
4. Click "Rollback" on previous deployment

## Security Considerations

### Branch Protection

Recommended branch protection rules for `main`:
- Require pull request reviews before merging
- Require status checks to pass (CI workflow)
- Require branches to be up to date
- Restrict who can push to main

### Secrets Management

- Never commit secrets to repository
- Use GitHub Secrets for sensitive data
- Rotate API tokens regularly
- Use different tokens for preview and production

### Access Control

- Limit who can trigger production deployments
- Use GitHub environments for approval requirements
- Enable required reviewers for production changes

## Performance

### Build Times

- CI workflow: ~2-3 minutes
- Preview deployment: ~3-4 minutes
- Production deployment: ~5-6 minutes (including smoke tests)

### Optimization

- `npm ci` uses cached dependencies
- Node.js setup is cached
- Build artifacts are not cached (intentional for security)

## Future Enhancements

Potential improvements to consider:

1. **Automated Database Migrations**: Add workflow to run migrations with manual approval
2. **Staging Environment**: Add staging deployment workflow
3. **Multi-Region Deployment**: Deploy to multiple Cloudflare regions
4. **Performance Testing**: Add Lighthouse CI for performance metrics
5. **Dependency Scanning**: Add npm audit workflow
6. **Release Notes**: Auto-generate changelog on deployment

## Related Documentation

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Manual deployment guide
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture and CI/CD specification
- [wrangler.jsonc](../wrangler.jsonc) - Cloudflare configuration

## Support

For issues with CI/CD automation:
1. Check GitHub Actions logs
2. Review Cloudflare dashboard for deployment status
3. Consult this documentation
4. Check DEPLOYMENT.md for manual deployment fallback
