# Monitoring and Alerting Guide

This document describes the monitoring and alerting infrastructure for the Laguna Hills HOA management system.

## Overview

The system implements a comprehensive monitoring stack with:

1. **CI/CD Alerting** - Slack notifications for deployment status
2. **Error Tracking** - Sentry integration for frontend and backend errors
3. **Application Monitoring** - Performance tracing and session replay
4. **Health Checks** - Automated smoke tests after deployments

## Table of Contents

- [CI/CD Alerting (Slack)](#cicd-alerting-slack)
- [Error Tracking (Sentry)](#error-tracking-sentry)
- [Environment Variables](#environment-variables)
- [Incident Response](#incident-response)
- [On-Call Procedures](#on-call-procedures)
- [Troubleshooting](#troubleshooting)

---

## CI/CD Alerting (Slack)

### Overview

All production deployments trigger automated Slack notifications for:
- ✅ Successful deployments
- 🚨 Failed deployments

### Setup

1. **Create Slack Incoming Webhook**
   - Go to https://api.slack.com/apps
   - Create a new app → "Incoming Webhooks"
   - Activate incoming webhooks
   - Add new webhook to your channel
   - Copy the webhook URL

2. **Add GitHub Secret**
   - Go to: https://github.com/laguna-hills-hoa/lhs-hoa/settings/secrets/actions
   - Add new repository secret:
     - Name: `SLACK_WEBHOOK_URL`
     - Value: (paste webhook URL)

3. **Verify Configuration**
   - Push a commit to `main` branch
   - Check Slack for notification
   - Should receive deployment success message

### Slack Notification Format

**Success Message Includes:**
- Environment (Production)
- Commit SHA with link
- Branch name
- Deployed by (GitHub actor)
- View Commit button

**Failure Message Includes:**
- Environment (Production)
- Commit SHA with link
- Branch name
- Deployed by (GitHub actor)
- View Logs button (links to failed workflow run)

### Notification Triggers

- **Success**: Only on `push` events to `main` branch
- **Failure**: All failed deployments (push and manual)

---

## Error Tracking (Sentry)

### Overview

Sentry captures and aggregates errors from:
- **Frontend**: Client-side JavaScript errors (React, Vite)
- **Backend**: Cloudflare Worker errors (Hono routes)

### Sentry Setup

#### 1. Create Sentry Project

1. Go to https://sentry.io/
2. Create a new project:
   - Platform: **JavaScript** (for frontend)
   - Platform: **Cloudflare Workers** (for backend)
3. Copy the DSN (Data Source Name) for each project

#### 2. Frontend Configuration

Add to `.env` or `.env.production`:

```bash
# Sentry Error Tracking
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_SAMPLE_RATE=0.1
VITE_APP_VERSION=1.0.0
```

**Optional** (for development testing):
```bash
VITE_ENABLE_SENTRY=true
```

#### 3. Backend Configuration

Add to `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "SENTRY_DSN": "https://your-dsn@sentry.io/project-id",
    "ENVIRONMENT": "production"
  }
}
```

Or add to GitHub Secrets for Workers:
- Secret: `SENTRY_DSN`
- Value: `https://your-dsn@sentry.io/project-id`

#### 4. Worker Integration

The Worker automatically initializes Sentry if `SENTRY_DSN` is configured.

To add Sentry to your Worker entry point (`worker/src/index.ts`):

```typescript
import { initSentry } from './lib/sentry';

// Initialize Sentry
initSentry({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT || 'production',
  release: env.RELEASE_VERSION || 'latest',
  tracesSampleRate: 0.1,
});
```

#### 5. Install Dependencies

**Frontend:**
```bash
npm install @sentry/browser
```

**Backend (Worker):**
```bash
cd worker
npm install @sentry/cloudflare
```

### Using Sentry

#### Frontend Error Capture

```typescript
import { captureException, captureMessage, setUser } from '@/lib/sentry';

// Capture exceptions
try {
  // ... code that might fail
} catch (error) {
  captureException(error, {
    context: 'userAction',
    action: 'submitForm'
  });
}

// Capture messages
captureMessage('User completed onboarding', 'info');

// Set user context (call after login)
setUser({
  id: user.id,
  email: user.email,
  role: user.role
});

// Clear user context (call after logout)
clearUser();

// Add breadcrumbs for context
addBreadcrumb({
  category: 'ui',
  message: 'User clicked submit',
  level: 'info'
});
```

#### Backend Error Capture

```typescript
import { captureExceptionWithContext, setSentryUser } from './lib/sentry';

// In error handler middleware
try {
  await next();
} catch (error) {
  captureExceptionWithContext(error, {
    user: { id: userId, email: userEmail },
    request: {
      method: c.req.method,
      path: c.req.path
    },
    tags: {
      route: c.req.path,
      runtime: 'worker'
    },
    extra: {
      body: await c.req.json()
    }
  });

  throw error;
}

// Set user context (in auth middleware)
setSentryUser({
  id: user.id,
  email: user.email,
  role: user.role
});
```

### Sentry Features

#### 1. Error Tracking
- Automatic capture of unhandled errors
- Stack traces and source maps
- User context (ID, email, role)
- Request context (URL, headers, body)

#### 2. Performance Monitoring
- Trace transactions (API calls, page loads)
- Track slow endpoints and database queries
- Monitor Core Web Vitals (LCP, FID, CLS)
- Sample rate: 10% (configurable via `VITE_SENTRY_TRACES_SAMPLE_RATE`)

#### 3. Session Replay
- Record user sessions leading to errors
- Video-like replay of user interactions
- Sample rate: 10% (configurable via `VITE_SENTRY_REPLAYS_SAMPLE_RATE`)
- 100% sample rate for sessions with errors

#### 4. Alerts
- Configure alerts in Sentry dashboard:
  - New error detected
  - Error rate increase
  - Performance degradation
  - Custom alert rules

### Sentry Best Practices

1. **Filter Noise**
   - Validation errors are filtered by default
   - Ignore expected client-side errors (4xx)
   - Use `beforeSend` to customize filtering

2. **Add Context**
   - Always include user context when authenticated
   - Add breadcrumbs for important user actions
   - Include request/response data for debugging

3. **Set Severity Levels**
   - `fatal`: System-wide outages
   - `error`: Application errors
   - `warning`: Deprecated API usage
   - `info`: Important business events
   - `debug`: Detailed troubleshooting data

4. **Release Tracking**
   - Tag errors with release versions
   - Track error rates by release
   - Identify regressions after deployments

---

## Environment Variables

### Frontend (.env)

```bash
# Sentry Configuration
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_SAMPLE_RATE=0.1
VITE_APP_VERSION=1.0.0
VITE_ENABLE_SENTRY=false # Enable for testing in dev
```

### Backend (wrangler.jsonc or GitHub Secrets)

```bash
SENTRY_DSN=https://your-dsn@sentry.io/project-id
ENVIRONMENT=production
RELEASE_VERSION=1.0.0
```

### GitHub Actions Secrets

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1 - Critical** | Complete system outage, all users affected | Immediate | Site down, database unreachable |
| **P2 - High** | Major feature broken, many users affected | 1 hour | Login broken, payments failing |
| **P3 - Medium** | Minor feature broken, some users affected | 4 hours | Map not loading, reports slow |
| **P4 - Low** | Cosmetic issue, edge cases | 1 day | Typos, alignment issues |

### Incident Response Procedure

#### 1. Detection (Alert Received)
- Check Slack for deployment failure notification
- Check Sentry for new error alerts
- Check GitHub Actions for failed workflows
- Check uptime monitoring (if configured)

#### 2. Assessment (5-15 minutes)
- Confirm severity (P1-P4)
- Identify affected users/features
- Check recent deployments
- Review Sentry error details
- Check infrastructure status (Cloudflare status page)

#### 3. Response (15-60 minutes)

**For P1/P2:**
1. Create incident channel in Slack: `#incident-description`
2. Notify on-call engineer and tech lead
3. Post status updates every 15 minutes
4. Implement fix or rollback
5. Verify fix resolves issue

**For P3/P4:**
1. Create task in project board
2. Assign to appropriate developer
3. Fix in next release or hotfix

#### 4. Resolution
- Confirm fix deployed and verified
- Monitor Sentry for recurring errors
- Update incident channel with resolution
- Write postmortem for P1/P2 incidents

#### 5. Post-Incident (P1/P2 only)
- Document root cause analysis
- Create action items to prevent recurrence
- Review monitoring gaps
- Update runbooks if needed

### Rollback Procedure

**Frontend Rollback (Cloudflare Pages):**
1. Go to Cloudflare Pages dashboard
2. Select `lhs-hoa` project
3. Navigate to Deployments
4. Find last successful deployment
5. Click "Rollback to this deployment"

**Backend Rollback (Worker):**
```bash
wrangler rollback --config wrangler.jsonc
```

Or deploy previous version:
```bash
git checkout <previous-commit>
wrangler deploy --config wrangler.jsonc
```

---

## On-Call Procedures

### On-Call Responsibilities

1. **Monitor Alerts**
   - Slack notifications (deployment failures)
   - Sentry alerts (error spikes, new issues)
   - Uptime monitoring (if configured)

2. **Response SLA**
   - P1 (Critical): 15 minutes
   - P2 (High): 1 hour
   - P3 (Medium): 4 hours
   - P4 (Low): 1 day

3. **Escalation Path**
   - Level 1: On-call engineer
   - Level 2: Tech lead / Senior engineer
   - Level 3: CTO / Engineering manager

### On-Call Handoff

1. **Weekly Rotation**
   - Rotate on-call responsibility weekly
   - Post on-call schedule in `#on-call` Slack channel

2. **Handoff Checklist**
   - No active incidents
   - Outstanding issues documented
   - Upcoming deployments noted
   - Contact information updated

### During On-Call Week

1. **Availability**
   - Keep phone notifications ON
   - Check Slack regularly
   - Respond to alerts within SLA

2. **Documentation**
   - Log all incidents in `#incident-*` channels
   - Update status every 15 minutes for active incidents
   - Document resolution in `docs/incidents/YYYY-MM-DD-summary.md`

3. **After Hours**
   - P1 incidents only
   - P2-P4 can wait until next business day
   - Use judgment for edge cases

---

## Troubleshooting

### Slack Notifications Not Working

**Symptoms:** No Slack messages after deployment

**Solutions:**
1. Check `SLACK_WEBHOOK_URL` secret is set in GitHub
2. Verify webhook URL is valid (test with curl):
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL -H 'Content-Type: application/json' -d '{"text":"Test"}'
   ```
3. Check GitHub Actions logs for webhook errors
4. Verify workflow has `notify` job enabled

### Sentry Not Capturing Errors

**Symptoms:** No errors appearing in Sentry dashboard

**Frontend:**
1. Check `VITE_SENTRY_DSN` is set in `.env`
2. Verify DSN is valid (copy from Sentry dashboard)
3. Check browser console for Sentry init errors
4. Enable `VITE_ENABLE_SENTRY=true` in development to test
5. Check `src/lib/sentry.ts` is imported in `src/main.tsx`

**Backend:**
1. Check `SENTRY_DSN` is set in `wrangler.jsonc` or GitHub Secrets
2. Verify DSN is valid
3. Check Worker logs for Sentry init errors
4. Verify `worker/src/lib/sentry.ts` is initialized in `worker/src/index.ts`
5. Test with manual error capture:
   ```typescript
   import { captureMessage } from './lib/sentry';
   captureMessage('Test message', 'info');
   ```

### Too Many Sentry Errors

**Symptoms:** Sentry quota exceeded, noisy error streams

**Solutions:**
1. Increase `tracesSampleRate` (currently 0.1 = 10%)
2. Decrease `replaysSessionSampleRate` (currently 0.1 = 10%)
3. Add more filtering in `beforeSend` callback
4. Ignore specific error types:
   - Validation errors (already filtered)
   - Network timeouts
   - Client-side 4xx errors
5. Set up alert rules to reduce noise

### Deployment Failed but No Alert

**Symptoms:** Deployment failed, no Slack notification

**Solutions:**
1. Check if workflow reached `notify` job (may have failed earlier)
2. Verify `if: always()` is set on notify job
3. Check workflow run logs in GitHub Actions
4. Verify Slack webhook action didn't fail (check logs)

### High Error Rate After Deployment

**Symptoms:** Sentry shows error spike after new release

**Solutions:**
1. **Immediate**: Rollback to previous version
2. **Investigation**:
   - Check Sentry for error patterns
   - Review recent commits for breaking changes
   - Check database migration issues
   - Verify environment variables
3. **Fix**: Create hotfix branch, test, deploy
4. **Prevention**: Add more tests, improve monitoring

---

## Monitoring Checklist

### Daily (Automated)
- [x] CI/CD deployments trigger Slack notifications
- [x] Sentry captures errors from frontend
- [x] Sentry captures errors from backend
- [x] Smoke tests run after deployment

### Weekly (On-Call)
- [ ] Review Sentry error report
- [ ] Check for error trends or spikes
- [ ] Review deployment success rate
- [ ] Update runbooks if needed

### Monthly (Tech Lead)
- [ ] Review all incidents from past month
- [ ] Update monitoring documentation
- [ ] Assess monitoring gaps
- [ ] Plan improvements (uptime monitoring, analytics)

---

## Future Improvements

### Planned Additions

1. **Uptime Monitoring**
   - UptimeRobot or Pingdom
   - 5-minute health checks
   - Alert on downtime > 2 minutes
   - Public status page

2. **Analytics**
   - Cloudflare Web Analytics
   - Track user behavior
   - Monitor performance metrics

3. **Advanced Alerting**
   - PagerDuty integration
   - On-call scheduling automation
   - SMS alerts for P1 incidents

4. **Log Aggregation**
   - Centralized logging (Cloudflare Logs)
   - Log retention and search
   - Alert on log patterns

5. **Security Monitoring**
   - Failed login attempt alerts
   - Rate limit violation notifications
   - Admin action audit logs

---

## Related Documentation

- [Deployment Guide](../README.md#deployment)
- [Architecture](../ARCHITECTURE.md)
- [API Documentation](../docs/API.md)
- [Troubleshooting](../docs/TROUBLESHOOTING.md)

---

**Last Updated:** 2026-03-07
**Maintained By:** @project-manager
