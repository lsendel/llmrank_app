# Deployment Rollback System

The LLM Rank platform includes a comprehensive deployment rollback system to quickly recover from failed deployments.

## Overview

```
┌─────────────────┐
│  GitHub Actions │
│  (Deploy)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Record Manifest │  ← Stores version, services, migrations
│ to KV Store     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Health Checks   │  ← Monitor deployment health
└────────┬────────┘
         │
         ▼ (if unhealthy)
┌─────────────────┐
│ Auto Rollback   │  ← Revert to previous version
│ or Manual       │
└─────────────────┘
```

## Features

- **Automatic deployment tracking** - Every deploy records metadata to KV
- **Health monitoring** - Continuous health checks of deployed services
- **Auto-rollback** - Automatic rollback if health checks fail within 5 minutes
- **Manual rollback** - CLI and API endpoints for manual intervention
- **Deployment history** - Last 50 deployments tracked
- **Migration safety** - Warns if database migrations can't be rolled back

## Deployment Tracking

### Recorded Metadata

Each deployment records:
- Version (git commit SHA)
- Timestamp
- Git branch and commit
- Service versions (API, Web, Crawler, Report Worker, MCP Gateway)
- Applied migrations
- Health check URLs
- Environment (production/staging/development)

### Storage

Deployment manifests are stored in Cloudflare KV:
- `deployment:manifest:current` - Current deployment
- `deployment:history` - Last 50 deployments

## Auto-Rollback

The system automatically rolls back if:
1. Deployment is less than 5 minutes old
2. Health checks fail for any service
3. Previous deployment is available

**Trigger:**
```bash
POST /api/deployment/auto-rollback
```

The auto-rollback endpoint can be called by:
- Monitoring systems (Datadog, Sentry, etc.)
- GitHub Actions (post-deploy health check)
- Cron job (scheduled health monitoring)

## Manual Rollback

### Via CLI

```bash
# Dry run - see what would be rolled back
pnpm tsx infra/scripts/rollback-deployment.ts --dry-run

# Rollback all services
pnpm tsx infra/scripts/rollback-deployment.ts

# Rollback specific service
pnpm tsx infra/scripts/rollback-deployment.ts --service=api
pnpm tsx infra/scripts/rollback-deployment.ts --service=web
pnpm tsx infra/scripts/rollback-deployment.ts --service=crawler
```

**Required environment variables:**
```bash
CF_API_TOKEN=your-cloudflare-api-token
CF_ACCOUNT_ID=your-account-id
KV_NAMESPACE_ID=your-kv-namespace-id
```

### Via API

**Check deployment status:**
```bash
GET /api/deployment/status
```

Response:
```json
{
  "data": {
    "version": "abc123ef",
    "healthy": true,
    "services": [
      { "name": "api", "healthy": true },
      { "name": "web", "healthy": true },
      { "name": "crawler", "healthy": true }
    ],
    "canRollback": true,
    "rollbackTarget": "def456ab"
  }
}
```

**Trigger rollback (admin only):**
```bash
POST /api/deployment/rollback
Content-Type: application/json

{
  "service": "all",
  "dryRun": false,
  "reason": "API errors after deployment"
}
```

Response:
```json
{
  "data": {
    "success": true,
    "previousVersion": "abc123ef",
    "newVersion": "def456ab",
    "servicesRolledBack": ["api", "web", "crawler", "reportWorker"],
    "duration": 45230
  }
}
```

**Get deployment history:**
```bash
GET /api/deployment/history?limit=10
```

## Health Checks

Each service exposes a `/health` endpoint:

| Service | URL |
|---------|-----|
| API | `https://api.llmrank.app/health` |
| Web | `https://llmrank.app/api/health` |
| Crawler | `https://llmrank-crawler.fly.dev/health` |

Health checks verify:
- HTTP 200 status
- Response within 5 seconds
- Service-specific health (database, queue, etc.)

## Database Migrations

**Important:** Database migrations are **forward-only** and cannot be automatically rolled back.

When rolling back:
1. The system warns if migrations were applied in the rolled-back version
2. Manual intervention may be required to undo schema changes
3. Data migrations must be carefully reviewed

**Best practices:**
- Make migrations backward-compatible when possible
- Test migrations in staging first
- Have a manual rollback plan for schema changes
- Use feature flags to decouple code from schema

## GitHub Actions Integration

The deployment workflow automatically records deployments:

```yaml
record-deployment:
  needs: [deploy-web, deploy-mcp-gateway]
  runs-on: ubuntu-latest
  steps:
    - name: Record deployment to KV
      run: pnpm tsx infra/scripts/record-deployment.ts
      env:
        CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
        KV_NAMESPACE_ID: ${{ secrets.KV_NAMESPACE_ID }}
        DEPLOYMENT_VERSION: ${{ github.sha }}
        DEPLOYMENT_ENV: production
```

## Monitoring & Alerts

### Recommended Alerts

**Critical:**
- Deployment health failed for > 2 minutes
- Auto-rollback triggered
- Rollback failed

**Warning:**
- Deployment took > 10 minutes
- Health check degraded (1 service unhealthy)
- Migration applied without rollback plan

### Monitoring Setup

**Option 1: Datadog**
```javascript
// Monitor deployment health
POST /api/deployment/status every 1 minute
Alert if healthy === false for 2 consecutive checks
```

**Option 2: Sentry**
```javascript
// Track deployment events
Sentry.setTag("deployment", version);
Sentry.addBreadcrumb({ category: "deployment", message: "deployed" });
```

**Option 3: GitHub Actions**
```yaml
- name: Post-deploy health check
  run: |
    sleep 30
    curl -f https://api.llmrank.app/health || \
      curl -X POST https://api.llmrank.app/api/deployment/auto-rollback
```

## Rollback Workflow

### Automatic Rollback

1. Deployment completes
2. Health check runs after 30 seconds
3. If unhealthy: auto-rollback triggered
4. Previous version deployed
5. Health check verifies recovery
6. Alert sent to team

### Manual Rollback

1. Issue detected in production
2. Admin confirms rollback needed
3. Run rollback script or API call
4. Script checks out previous commit
5. Redeploys all services
6. Verifies health
7. Updates deployment manifest

## Rollback Checklist

Before rolling back, verify:

- [ ] Issue is deployment-related (not data or external service)
- [ ] Previous deployment is available in history
- [ ] No database migrations in rolled-back version (or rollback plan exists)
- [ ] Team is notified
- [ ] Monitoring is watching for errors

After rolling back:

- [ ] Verify all services are healthy
- [ ] Check error rates in monitoring
- [ ] Review logs for residual issues
- [ ] Document root cause
- [ ] Plan fix for next deployment

## Limitations

### What Can Be Rolled Back

- ✅ Code changes
- ✅ Environment variables (via wrangler.toml)
- ✅ Worker scripts
- ✅ Frontend assets
- ✅ Feature flags

### What Cannot Be Rolled Back

- ❌ Database schema changes (forward-only migrations)
- ❌ Data changes (irreversible operations)
- ❌ Third-party service configurations (Stripe, Clerk, etc.)
- ❌ DNS changes
- ❌ External API contracts

## Disaster Recovery

If rollback fails or previous version is unavailable:

1. **Emergency hotfix:**
   ```bash
   git revert <bad-commit>
   git push origin main
   # CI will deploy the revert
   ```

2. **Manual revert:**
   ```bash
   # Checkout last known good commit
   git checkout <good-commit>

   # Force deploy
   cd apps/api && npx wrangler deploy
   cd apps/web && npx wrangler deploy --config wrangler.jsonc
   ```

3. **Feature flag kill switch:**
   ```typescript
   // Disable problematic feature
   const featureFlags = await getFeatureFlags();
   if (!featureFlags.new_feature_enabled) {
     return legacyBehavior();
   }
   ```

## Testing Rollback

### In Staging

```bash
# Deploy to staging
git push origin staging

# Record deployment
DEPLOYMENT_ENV=staging pnpm tsx infra/scripts/record-deployment.ts

# Trigger rollback
pnpm tsx infra/scripts/rollback-deployment.ts --dry-run

# Verify manifest
curl https://api-staging.llmrank.app/api/deployment/history
```

### Rollback Drill

Regularly practice rollback:
1. Deploy known-good version
2. Deploy version with intentional bug
3. Detect issue via monitoring
4. Execute rollback
5. Verify recovery
6. Document timing and issues

**Target:** Complete rollback in < 2 minutes

## Future Enhancements

- [ ] **Blue-green deployments** - Zero-downtime rollback
- [ ] **Canary releases** - Gradual rollout with automatic rollback
- [ ] **Feature flag integration** - Kill switch for new features
- [ ] **Deployment approval gates** - Require approval before production
- [ ] **Automated health check suite** - Comprehensive post-deploy tests
- [ ] **Rollback analytics** - Track rollback frequency and causes
- [ ] **Database rollback automation** - Safe schema migration rollback
- [ ] **Multi-region rollback** - Coordinate rollback across regions

## Security

### Access Control

- Deployment recording: CI/CD only (GitHub Actions)
- Health check viewing: Authenticated users
- Manual rollback: Admins only
- Auto-rollback: System-triggered (no auth required)

### Audit Trail

All rollbacks are logged:
- Who triggered (user ID or "system")
- When (timestamp)
- What (services rolled back)
- Why (reason, if provided)
- Result (success/failure)

### Secrets

Store in GitHub Secrets:
- `CF_API_TOKEN` - Cloudflare API token (Workers:Edit)
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `KV_NAMESPACE_ID` - KV namespace for deployment tracking

## Support

**If rollback fails:**
1. Check GitHub Actions logs
2. Verify KV namespace is accessible
3. Ensure CF_API_TOKEN has Workers:Edit permission
4. Review deployment history in KV console
5. Contact platform team in #platform-incidents Slack channel

**Emergency contacts:**
- Platform Lead: @platform-lead
- DevOps: @devops-oncall
- Escalation: CEO (critical production outages only)
