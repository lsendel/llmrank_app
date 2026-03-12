# Observability Stack

LLM Rank uses a comprehensive observability stack for production monitoring and debugging.

## Components

### 1. Structured Logging (Axiom)

All application logs are structured JSON sent to Axiom for centralized log management.

**Features:**

- Automatic log ingestion to Axiom (when configured)
- Structured JSON format with context (requestId, userId, projectId, etc.)
- Log levels: debug, info, warn, error
- Child loggers with inherited context
- Fire-and-forget to avoid blocking requests

**Configuration:**

```bash
# Required environment variables
AXIOM_TOKEN=your-api-token
AXIOM_DATASET=your-dataset-name
```

**Usage in code:**

```typescript
const logger = c.var.logger; // From Hono context

logger.info("User action completed", { action: "create_project" });
logger.error("Database query failed", {
  error: err.message,
  query: "SELECT...",
});

// Create child logger with additional context
const childLogger = logger.child({ projectId: "abc123" });
childLogger.info("Processing crawl"); // Automatically includes projectId
```

### 2. Metrics Tracking

Automatic HTTP request metrics sent to Axiom for performance monitoring.

**Tracked Metrics:**

- `http_request_duration_ms` - Request latency
- `http_request_errors` - Error rate (4xx, 5xx)
- `http_request_success` - Success rate

**Metric Tags:**

- method (GET, POST, etc.)
- path (normalized with /:id for UUIDs)
- status (200, 404, 500, etc.)
- error_class (client_error, server_error)
- environment (production, preview)

**Querying metrics in Axiom:**

```axiom
['http_request_duration_ms']
| where environment == 'production'
| summarize avg(value), p95(value), p99(value) by path
| order by avg_value desc
```

### 3. Error Tracking (Sentry)

Production errors are automatically captured by Sentry with full context.

**Features:**

- Error grouping and deduplication
- Stack traces and breadcrumbs
- Release tracking
- User impact analysis
- Performance monitoring (when enabled)

**Configuration:**

```bash
SENTRY_DSN=your-sentry-dsn
```

### 4. Health Checks

Deep health check endpoint monitors all infrastructure dependencies.

**Endpoint:** `GET /api/health/deep`

**Monitored services:**

- Database (PostgreSQL)
- R2 Storage
- KV Cache
- Crawler Service
- Anthropic LLM API
- OpenAI LLM API

**Response:**

```json
{
  "status": "healthy|degraded|down",
  "timestamp": "2026-03-11T10:00:00Z",
  "total_latency_ms": 123,
  "checks": {
    "database": { "status": "healthy", "latency": 45 },
    "r2_storage": { "status": "healthy", "latency": 23 },
    ...
  }
}
```

## Dashboards

### Axiom Dashboards

**Request Performance:**

```axiom
['http_request_duration_ms']
| where environment == 'production'
| summarize
    avg_latency = avg(value),
    p95_latency = percentile(value, 95),
    p99_latency = percentile(value, 99)
  by bin(_time, 5m), path
```

**Error Rate:**

```axiom
['http_request_errors']
| where environment == 'production'
| summarize error_count = count() by bin(_time, 5m), status, error_class
```

**Traffic Volume:**

```axiom
['http_request_success'] + ['http_request_errors']
| summarize requests = count() by bin(_time, 5m), method
```

### Sentry Alerts

Configure alerts for:

- Error rate > 1% of requests
- New error types
- Performance degradation (p95 > 1s)

## Local Development

In local development, observability features work with fallbacks:

- **Logs:** Always written to console (captured by `wrangler tail`)
- **Axiom:** Skipped if `AXIOM_TOKEN` not configured
- **Sentry:** Disabled in development (via `withSentry` wrapper)
- **Metrics:** Calculated but only logged locally

## Production Setup

1. **Create Axiom account** and dataset
2. **Add secrets to Cloudflare:**
   ```bash
   wrangler secret put AXIOM_TOKEN
   wrangler secret put AXIOM_DATASET
   ```
3. **Configure Sentry** project and add DSN:
   ```bash
   wrangler secret put SENTRY_DSN
   ```
4. **Deploy** and verify logs in Axiom dashboard

## Monitoring Best Practices

1. **Always use structured logging:**

   ```typescript
   // Good
   logger.info("Crawl completed", { jobId, pageCount, duration });

   // Bad
   logger.info(`Crawl ${jobId} completed with ${pageCount} pages`);
   ```

2. **Include request context:**

   ```typescript
   const logger = c.var.logger; // Has requestId, userId automatically
   ```

3. **Track custom metrics:**

   ```typescript
   import { trackMetric } from "@/lib/observability";

   trackMetric({
     name: "llm_api_tokens",
     value: tokensUsed,
     tags: { provider: "anthropic", model: "claude-3" },
   });
   ```

4. **Use child loggers for operations:**
   ```typescript
   const operationLogger = logger.child({ operation: "crawl", projectId });
   operationLogger.info("Starting crawl");
   // ... crawl logic
   operationLogger.info("Crawl completed", { pageCount });
   ```

## Cost Optimization

- **Log retention:** Configure Axiom to retain logs for 30 days (production), 7 days (preview)
- **Sampling:** Consider sampling high-volume endpoints (> 1000 req/min)
- **Log levels:** Use `info` in production, `debug` only when investigating issues
- **Metric cardinality:** Normalize paths to avoid explosion (`:id` instead of UUIDs)
