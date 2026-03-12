# Queue System

The LLM Rank platform uses a queue abstraction layer to support multiple queue backends for reliable asynchronous job processing. This enables graceful degradation and easy migration between queue implementations.

## Architecture

```
┌──────────────┐
│  API Worker  │
│  (Hono)      │
└──────┬───────┘
       │
       │ QueueService
       │
       ▼
┌────────────────────────┐
│   Queue Adapter Layer  │
├────────────────────────┤
│ ┌──────────────────┐   │
│ │  Redis Adapter   │   │  ← Production (Upstash Redis)
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │  Memory Adapter  │   │  ← Development/Testing
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │  Future: NATS    │   │  ← Scale target
│ └──────────────────┘   │
└────────────────────────┘
       │
       ▼
┌──────────────┐
│   Workers    │
│  (Crawler)   │
└──────────────┘
```

## Queue Adapters

### Redis Adapter (Production)

Recommended for production use with Upstash Redis (Cloudflare Workers compatible).

**Features:**
- Persistent message storage
- Delayed message execution
- Exponential backoff retry
- Dead letter queue (DLQ)
- Message deduplication
- At-least-once delivery

**Usage:**
```typescript
import { RedisQueueAdapter } from "@llm-boost/shared";
import { Redis } from "@upstash/redis/cloudflare";

const redis = new Redis({
  url: env.UPSTASH_REDIS_URL,
  token: env.UPSTASH_REDIS_TOKEN,
});

const queue = new RedisQueueAdapter(redis, {
  defaultMaxAttempts: 3,
  messageIdPrefix: "llmrank",
});
```

### Memory Adapter (Development)

In-memory queue for local development and testing. **Not suitable for production** - data is lost on restart.

**Usage:**
```typescript
import { MemoryQueueAdapter } from "@llm-boost/shared";

const queue = new MemoryQueueAdapter();
```

## Queue Service API

The `QueueService` provides a high-level API for queue operations:

```typescript
import { createQueueService } from "./services/queue-service";

const queueService = createQueueService({ queue: adapter });

// Enqueue a crawl job
const messageId = await queueService.enqueueCrawlJob(payload, {
  priority: "high",
  delay: 5000, // 5 second delay
});

// Check queue health
const health = await queueService.getQueueHealth();

// Get queue stats
const stats = await queueService.getQueueStats(QUEUE_NAMES.CRAWL_JOBS);
```

## Available Queues

| Queue Name | Purpose | Max Attempts | Typical Delay |
|-----------|---------|--------------|---------------|
| `crawl:jobs` | Crawl job requests | 3 | 0ms |
| `crawl:results` | Crawl result processing | 3 | 0ms |
| `scoring:pages` | Page scoring jobs | 5 | 0ms |
| `visibility:checks` | LLM visibility checks | 3 | 60000ms |
| `notifications:send` | Email/webhook notifications | 5 | 0ms |
| `exports:generate` | Report generation | 3 | 0ms |

## Message Lifecycle

1. **Enqueue**: Message is added to queue with optional delay
2. **Dequeue**: Worker picks up message for processing
3. **Processing**: Message is in "processing" state
4. **Completion**: Worker calls `ack()` or `nack()`
   - `ack()`: Success - message is deleted, stats incremented
   - `nack()`: Failure - message is retried with exponential backoff
5. **Max Retries**: After max attempts, message moves to DLQ

### Retry Backoff Strategy

Exponential backoff with jitter (±20%):
- Attempt 1: ~1s
- Attempt 2: ~2s
- Attempt 3: ~4s
- Attempt 4: ~8s
- Attempt 5: ~16s
- Max: 32s

## Integration with Crawl Service

The crawl service now supports both queue-based and HTTP-based dispatch:

```typescript
// Queue-based dispatch (preferred)
const crawlService = createCrawlService({
  crawls,
  projects,
  users,
  scores,
  queueService, // ← Optional queue service
});

// If queueService is provided:
// - Jobs are enqueued to Redis/Memory queue
// - Crawler workers poll the queue
// - Better reliability, retry logic, observability

// If queueService is NOT provided:
// - Falls back to direct HTTP POST to crawler
// - Legacy behavior, immediate dispatch
// - No automatic retries
```

## Environment Variables

```bash
# Production (Upstash Redis)
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token-here

# Development (Memory Queue)
# No env vars needed - automatically uses MemoryQueueAdapter
```

## Monitoring & Observability

### Queue Metrics

All queue adapters expose stats via the `stats()` method:

```typescript
const stats = await queue.stats("crawl:jobs");
// {
//   depth: 142,        // Messages waiting
//   processing: 8,     // Currently processing
//   failed: 3,         // Dead letter queue count
//   completed: 12458   // Total completed
// }
```

### Health Checks

Include queue health in the `/health` endpoint:

```typescript
const queueHealth = await queueService.getQueueHealth();
// { status: "healthy" | "degraded" | "down", message?: string }
```

### Dead Letter Queue (DLQ)

Messages that fail after max retries are moved to the DLQ:
- Redis: `queue:{name}:dlq`
- Memory: `getDeadLetterQueue(queueName)`

Monitor DLQ depth and alert on anomalies.

## Migration Path

### Current State
- Direct HTTP dispatch to crawler
- No queue abstraction
- No automatic retries

### Phase 1: Add Queue Support (This PR)
- ✅ Queue abstraction layer
- ✅ Redis + Memory adapters
- ✅ Crawl service integration
- ✅ Backward compatible (HTTP fallback)

### Phase 2: Deploy Redis Queue (Next)
- Configure Upstash Redis
- Deploy with queue service enabled
- Monitor metrics, validate reliability
- Keep HTTP fallback for safety

### Phase 3: Remove HTTP Fallback (Future)
- Remove direct crawler dispatch
- Queue becomes primary dispatch method
- Crawler polls queue exclusively

### Phase 4: Scale to NATS JetStream (Future)
- High throughput requirements
- Multi-region deployment
- Implement NATS adapter
- Migrate from Redis

## Testing

### Unit Tests

Test queue adapters in isolation:

```bash
cd packages/shared
pnpm test queue
```

**Coverage:**
- Enqueue/dequeue operations
- Delayed messages
- Retry logic
- DLQ behavior
- Stats tracking
- Health checks

### Integration Tests

Test end-to-end crawl dispatch:

```bash
cd apps/api
pnpm test crawl-service
```

## Performance Considerations

### Redis Adapter
- **Latency**: ~5-10ms (Upstash global)
- **Throughput**: 10,000+ msg/s (Upstash limits)
- **Cost**: ~$10/mo (10GB storage, 1M commands)
- **Scalability**: Horizontal (multiple workers)

### Memory Adapter
- **Latency**: <1ms (in-process)
- **Throughput**: Unlimited (in-memory)
- **Cost**: $0
- **Scalability**: Vertical only (single worker)

## Security

### Message Signing

Crawl job payloads are HMAC-signed before enqueueing:

```typescript
const payload: CrawlJobPayload = {
  job_id: crawlJob.id,
  callback_url: callbackUrl,
  config: crawlConfig,
};

// Queue handles signing internally
await queueService.enqueueCrawlJob(payload);
```

### Access Control

Queue operations require authentication:
- Enqueue: User must own the project
- Dequeue: Crawler must present valid HMAC
- Admin: Stats/purge require admin role

## Troubleshooting

### Queue Depth Growing

**Symptom**: `depth` metric increasing over time

**Causes**:
- Workers not processing fast enough
- Workers crashed/offline
- Messages stuck in retry loop

**Solutions**:
- Scale workers horizontally
- Check worker logs for errors
- Inspect DLQ for failed messages
- Increase retry delays

### High DLQ Count

**Symptom**: `failed` metric increasing

**Causes**:
- Malformed messages
- External service down (crawler, LLM API)
- Configuration errors

**Solutions**:
- Inspect DLQ messages
- Fix root cause (validation, config)
- Replay DLQ messages after fix

### Queue Unavailable

**Symptom**: `health()` returns "down"

**Causes**:
- Redis connection lost
- Upstash outage
- Network issues

**Solutions**:
- Check Upstash status page
- Verify REDIS_URL/TOKEN env vars
- Failover to HTTP dispatch (automatic)

## Best Practices

1. **Idempotent Workers**: Workers should handle duplicate messages gracefully (use `deduplicationId`)
2. **Timeout Protection**: Set appropriate timeouts for long-running jobs
3. **Structured Logging**: Log queue operations with correlation IDs
4. **Monitoring**: Alert on queue depth, DLQ count, processing lag
5. **Graceful Degradation**: Always have a fallback mechanism
6. **Deduplication**: Use `deduplicationId` to prevent duplicate jobs
7. **Delays for Rate Limiting**: Use delays to respect external API limits

## Future Enhancements

- [ ] **Priority Queues**: High/normal/low priority lanes
- [ ] **Batch Operations**: `enqueueBatch()` for bulk dispatch
- [ ] **Message TTL**: Expire old messages automatically
- [ ] **Scheduled Jobs**: Cron-like recurring jobs
- [ ] **Observability**: OpenTelemetry tracing
- [ ] **NATS Adapter**: For high-scale deployments
- [ ] **CloudFlare Queues**: Native CF queue support
- [ ] **Worker Scaling**: Auto-scale based on queue depth
