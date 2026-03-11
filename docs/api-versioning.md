# API Versioning Strategy

LLM Rank API follows a comprehensive versioning strategy to ensure backward compatibility while enabling evolution of the API surface.

## Overview

- **Current Version:** v1
- **Latest Version:** v1
- **Supported Versions:** v1
- **Versioning Scheme:** URL-based with optional header-based version negotiation

## Version Negotiation

The API version can be specified in three ways (in priority order):

### 1. Path-Based Versioning (Recommended)

```http
GET /api/v1/projects/abc123 HTTP/1.1
Host: api.llmrank.app
```

Most explicit and recommended for all clients.

### 2. Custom Header

```http
GET /api/projects/abc123 HTTP/1.1
Host: api.llmrank.app
X-API-Version: v1
```

Useful when path structure cannot be changed (legacy clients).

### 3. Accept Header (Content Negotiation)

```http
GET /api/projects/abc123 HTTP/1.1
Host: api.llmrank.app
Accept: application/vnd.llmrank.v1+json
```

Standards-compliant content negotiation approach.

### Default Behavior

If no version is specified, the API defaults to the **latest stable version (v1)**.

## Response Headers

All API responses include version information headers:

```http
HTTP/1.1 200 OK
X-API-Version: v1
X-Supported-Versions: v1
```

## Current API Structure

### Versioned Routes (`/api/v1`)

External API endpoints for programmatic access (API tokens required):

| Endpoint                                      | Method | Description                  |
| --------------------------------------------- | ------ | ---------------------------- |
| `/api/v1/projects/:id`                        | GET    | Get project details          |
| `/api/v1/projects/:id/metrics`                | GET    | Get project scores           |
| `/api/v1/projects/:id/pages`                  | GET    | List page scores (paginated) |
| `/api/v1/projects/:id/issues`                 | GET    | List issues by severity      |
| `/api/v1/projects/:id/visibility`             | GET    | Visibility checks + trends   |
| `/api/v1/projects/:id/visibility/check`       | POST   | Trigger visibility check     |
| `/api/v1/projects/:id/keywords/opportunities` | GET    | Keyword opportunities        |
| `/api/v1/projects/:id/action-items`           | GET    | Project action items         |
| `/api/v1/crawls`                              | POST   | Trigger new crawl            |
| `/api/v1/score`                               | POST   | Real-time page scoring       |

**Authentication:** API token required (via `Authorization: Bearer <token>`)

### Unversioned Routes (`/api`)

Internal routes used by the web app (session-based auth):

- `/api/projects` - Project CRUD
- `/api/crawls` - Crawl management
- `/api/pages` - Page data
- `/api/billing` - Stripe billing
- `/api/dashboard` - Dashboard data
- `/api/account` - User account
- And 30+ more endpoints...

**Authentication:** Session cookie or better-auth

## Breaking vs Non-Breaking Changes

### Non-Breaking Changes (Same Version)

These changes do NOT require a new API version:

✅ **Adding new endpoints**

- `/api/v1/projects/:id/new-feature`

✅ **Adding optional parameters**

```json
{
  "name": "Project",
  "description": "Optional new field"
}
```

✅ **Adding response fields**

```json
{
  "id": "abc",
  "name": "Project",
  "newField": "Additional data"
}
```

✅ **Relaxing validation rules**

- Accepting more formats for a field
- Making required fields optional

✅ **Adding new error codes**

- New specific error codes for better diagnostics

### Breaking Changes (New Version Required)

These changes REQUIRE a new API version (v2):

❌ **Removing endpoints**

- Deleting `/api/v1/projects/:id`

❌ **Removing response fields**

```json
{
  "id": "abc"
  // "name" field removed
}
```

❌ **Changing field types**

```json
{
  "createdAt": 1234567890 // was string, now number
}
```

❌ **Renaming fields**

```json
{
  "projectId": "abc" // was "id"
}
```

❌ **Making optional fields required**

- Previously optional `description` is now required

❌ **Changing URL structure**

- `/api/v1/projects/:id` → `/api/v1/workspaces/:id`

❌ **Changing HTTP methods**

- `GET /api/v1/projects/:id/metrics` → `POST /api/v1/projects/:id/metrics`

## Deprecation Process

When introducing breaking changes:

### 1. Announce Deprecation

Add deprecation headers to the old endpoint:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: 2026-12-31T23:59:59Z
Link: </api/v2/projects>; rel="successor-version"
```

### 2. Migration Period

- **Minimum:** 6 months notice before sunset
- **Communication:** Email all API token holders
- **Documentation:** Clear migration guide

### 3. Monitor Usage

Track deprecated endpoint usage via metrics:

```typescript
trackMetric({
  name: "api_deprecated_endpoint_usage",
  value: 1,
  tags: { endpoint: "/api/v1/old-endpoint", version: "v1" },
});
```

### 4. Final Sunset

After sunset date, return 410 Gone:

```http
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "error": {
    "code": "ENDPOINT_RETIRED",
    "message": "This endpoint was sunset on 2026-12-31. Use /api/v2/projects instead.",
    "sunsetDate": "2026-12-31T23:59:59Z",
    "replacement": "/api/v2/projects"
  }
}
```

## Example: Deprecating an Endpoint

```typescript
import { deprecatedEndpoint } from "../middleware/api-version";

// Old endpoint (v1) with deprecation
app.get(
  "/api/v1/projects/:id/action-plan",
  deprecatedEndpoint(
    "2027-06-30T23:59:59Z",
    "/api/v1/projects/:id/action-items",
  ),
  async (c) => {
    // Handler implementation
  },
);

// New endpoint (v1) - successor
app.get("/api/v1/projects/:id/action-items", async (c) => {
  // New implementation
});
```

## Version-Specific Behavior

For endpoints that need different behavior per version:

```typescript
import { VersionRouter } from "../middleware/api-version";

const router = new VersionRouter();

router
  .version("v1", async (c) => {
    // v1 behavior
    return c.json({ format: "old" });
  })
  .version("v2", async (c) => {
    // v2 behavior with breaking changes
    return c.json({ responseFormat: "new" });
  });

app.get("/api/projects/:id", async (c) => router.handle(c));
```

## Client Guidelines

### For API Consumers

1. **Always specify version explicitly** in path:

   ```bash
   curl https://api.llmrank.app/api/v1/projects/abc123
   ```

2. **Monitor deprecation headers** in responses:

   ```bash
   curl -I https://api.llmrank.app/api/v1/old-endpoint
   # Check for: Deprecation, Sunset, Link headers
   ```

3. **Pin to specific version** in production:

   ```typescript
   const API_VERSION = "v1"; // Don't use "latest"
   const url = `https://api.llmrank.app/api/${API_VERSION}/projects`;
   ```

4. **Test against new versions** before migration:
   ```bash
   # Test v2 while still using v1 in production
   curl https://api.llmrank.app/api/v2/projects/abc123
   ```

### For Web App (Internal)

The Next.js web app can continue using unversioned `/api/*` routes:

```typescript
// apps/web/src/lib/api.ts
export async function getProject(id: string) {
  // Unversioned, used by first-party web app only
  const res = await fetch(`/api/projects/${id}`);
  return res.json();
}
```

These routes are **not subject to versioning** as they're tightly coupled to the frontend and deployed together.

## Migration Roadmap

### Current State (v1)

- 40+ unversioned `/api/*` endpoints for web app
- 15 versioned `/api/v1/*` endpoints for external API

### Future Plans

#### Phase 1: Expand v1 Coverage (Q2 2026)

Add versioned equivalents for commonly requested features:

- `/api/v1/reports` - Report generation
- `/api/v1/competitors` - Competitor monitoring
- `/api/v1/integrations` - GSC integration management

#### Phase 2: Version 2 (Q4 2026)

Introduce v2 with breaking changes:

- Consistent pagination (cursor-based everywhere)
- Unified error format
- Standardized date formats (ISO 8601)
- Renamed ambiguous fields (id → projectId, etc.)

#### Phase 3: Sunset v1 (Q2 2027)

- 6-month deprecation notice
- Migration tooling and documentation
- Gradual sunset with usage monitoring

## Versioning in Tests

Test multiple API versions:

```typescript
describe("API v1", () => {
  it("returns project metrics", async () => {
    const res = await app.request("/api/v1/projects/abc/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });
});

describe("Version negotiation", () => {
  it("accepts version via header", async () => {
    const res = await app.request("/api/projects/abc", {
      headers: { "X-API-Version": "v1" },
    });
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("defaults to latest version", async () => {
    const res = await app.request("/api/projects/abc");
    expect(res.headers.get("X-API-Version")).toBe("v1"); // latest
  });
});
```

## Error Handling

### Version Mismatch

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VERSION_MISMATCH",
    "message": "This endpoint requires API version v2, but v1 was requested",
    "supportedVersions": ["v1", "v2"]
  }
}
```

### Unsupported Version

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VERSION_NOT_SUPPORTED",
    "message": "API version v3 is not supported",
    "supportedVersions": ["v1", "v2"]
  }
}
```

## Best Practices

### DO ✅

- Use semantic versioning for major versions (v1, v2, v3)
- Add version to ALL external API endpoints
- Provide clear migration documentation
- Monitor deprecated endpoint usage
- Give 6+ months notice before breaking changes
- Include version in response headers
- Test version negotiation logic

### DON'T ❌

- Don't use date-based versioning (2024-01-01)
- Don't version internal web app routes
- Don't break compatibility without major version bump
- Don't remove deprecated endpoints without notice
- Don't change behavior based on client identity
- Don't use query parameters for versioning (?version=1)

## Changelog

### v1 (2026-01-15) - Initial Release

**Endpoints Added:**

- Project metrics, pages, issues
- Visibility checks
- Crawl triggering
- Real-time scoring
- Action items

**Scopes:**

- `projects:read`, `projects:write`
- `crawls:write`
- `scores:read`
- `visibility:read`, `visibility:write`
- `metrics:read`

## Resources

- [API Token Management](/dashboard/settings/api)
- [OpenAPI Specification](/api/v1/openapi.json) (planned)
- [Postman Collection](/api/v1/postman.json) (planned)
- [SDK Documentation](https://github.com/llmrank/sdk) (planned)

## Support

Questions about API versioning? Contact support@llmrank.app
