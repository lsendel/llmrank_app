# E2E Testing Guide

Comprehensive end-to-end test suite for LLM Rank application covering all critical user journeys and features.

## Test Coverage

Total: **42 test specs** across 9 test files

### Test Files

| File                            | Specs | Description                                                               |
| ------------------------------- | ----- | ------------------------------------------------------------------------- |
| `smoke.spec.ts`                 | 2     | Basic smoke tests (homepage, login/signup pages)                          |
| `billing.spec.ts`               | 1     | Complete billing lifecycle (signup, upgrade, downgrade, cancel)           |
| `journeys.spec.ts`              | 3     | Core operational journeys (scan-to-workspace, project workflow, settings) |
| `crawl-management.spec.ts`      | 6     | Crawl creation, status, results, re-run, filtering                        |
| `report-generation.spec.ts`     | 6     | Manual/scheduled reports, downloads, sharing, customization               |
| `competitor-monitoring.spec.ts` | 5     | Add/remove competitors, comparisons, auto-discovery                       |
| `project-management.spec.ts`    | 6     | CRUD operations on projects, filtering, archiving                         |
| `issue-management.spec.ts`      | 7     | View, filter, resolve issues, export, history                             |
| `integrations.spec.ts`          | 6     | GSC integration, API tokens, webhooks                                     |

## Running Tests

### Prerequisites

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Install Playwright browsers:**
   ```bash
   pnpm --filter @llm-boost/web exec playwright install chromium
   ```

### Local Development

**Run all tests:**

```bash
cd apps/web
pnpm exec playwright test
```

**Run specific test file:**

```bash
pnpm exec playwright test e2e/smoke.spec.ts
pnpm exec playwright test e2e/crawl-management.spec.ts
```

**Run with UI mode (interactive debugging):**

```bash
pnpm exec playwright test --ui
```

**Run in headed mode (see browser):**

```bash
HEADLESS=false pnpm exec playwright test
```

**Debug a specific test:**

```bash
pnpm exec playwright test e2e/billing.spec.ts --debug
```

### Environment Variables

Different test files require different environment variables:

**Smoke tests** (`smoke.spec.ts`):

- `BASE_URL` - The application URL to test (default: http://localhost:3000)

**Authenticated tests** (all other files):

- `E2E_EMAIL` - Test account email
- `E2E_PASSWORD` - Test account password
- `E2E_PROJECT_ID` - Existing project ID for tests that require a project
- `E2E_SCAN_DOMAIN` - Domain to use for scan tests (default: example.com)
- `BASE_URL` - The application URL (optional)

**Example .env.test:**

```bash
BASE_URL=http://localhost:3000
E2E_EMAIL=test@example.com
E2E_PASSWORD=SecurePassword123!
E2E_PROJECT_ID=abc123-def456-ghi789
E2E_SCAN_DOMAIN=example.com
```

**Load environment variables:**

```bash
export $(grep -v '^#' .env.test | xargs)
pnpm exec playwright test
```

### Against Deployed Environment

Test against preview or production deployments:

```bash
BASE_URL=https://llmrank-preview.pages.dev \
E2E_EMAIL=test@example.com \
E2E_PASSWORD=YourPassword123! \
E2E_PROJECT_ID=your-project-id \
pnpm exec playwright test
```

### CI Pipeline

The CI pipeline (`ci.yml`) validates all test specs using `--list` to ensure they're syntactically correct:

```bash
pnpm --filter @llm-boost/web exec playwright test e2e/*.spec.ts --list
```

This catches:

- Import errors
- Syntax errors
- Missing dependencies
- Configuration issues

**Note:** Actual test execution in CI requires a running application instance and test credentials, which should be configured separately in a dedicated E2E workflow.

## Test Organization

### Test Structure

Each test file follows this pattern:

```typescript
import { test, expect, type Page } from "@playwright/test";

// Environment variables
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

// Reusable helper functions
async function loginIfNeeded(page: Page) {
  // Login logic...
}

// Test suite
test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test("specific user action", async ({ page }) => {
    test.setTimeout(60000);
    // Test implementation...
  });
});
```

### Best Practices

1. **Skip tests gracefully** when required env vars are missing:

   ```typescript
   if (!E2E_EMAIL || !E2E_PASSWORD) {
     test.skip(true, "E2E_EMAIL/E2E_PASSWORD required");
     return;
   }
   ```

2. **Use appropriate timeouts** for slow operations:

   ```typescript
   test.setTimeout(90000); // 90 seconds for slow operations
   ```

3. **Wait for navigation and elements**:

   ```typescript
   await page.waitForURL(/\/dashboard/);
   await expect(element).toBeVisible({ timeout: 10000 });
   ```

4. **Handle conditional UI elements**:

   ```typescript
   if (await element.isVisible()) {
     await element.click();
   }
   ```

5. **Use flexible selectors** to handle UI variations:
   ```typescript
   page.getByRole("button", { name: /sign in|continue|login/i });
   ```

## Creating New Tests

### 1. Identify User Journey

Map out the complete user flow:

- Entry point (URL or navigation)
- User actions (clicks, form fills, etc.)
- Expected outcomes (redirects, UI changes, data updates)

### 2. Create Test File

```bash
touch apps/web/e2e/new-feature.spec.ts
```

### 3. Implement Tests

```typescript
import { test, expect } from "@playwright/test";

test.describe("New Feature", () => {
  test("user can perform action", async ({ page }) => {
    await page.goto("/feature");

    // Interact with page
    await page.getByRole("button", { name: /action/i }).click();

    // Verify outcome
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

### 4. Update CI Configuration

Add your new test file to `.github/workflows/ci.yml`:

```yaml
- name: Verify E2E test specs are valid
  run: |
    # ... existing tests
    pnpm --filter @llm-boost/web exec playwright test e2e/new-feature.spec.ts --list
```

### 5. Document in This Guide

Add your test file to the coverage table above.

## Debugging Failures

### View Test Report

After test run:

```bash
pnpm exec playwright show-report
```

### Generate Trace

Run with trace enabled:

```bash
pnpm exec playwright test --trace on
```

View trace:

```bash
pnpm exec playwright show-trace trace.zip
```

### Screenshot on Failure

Playwright automatically captures screenshots on failure. Find them in `test-results/` directory.

### Debug Mode

Run in debug mode to step through tests:

```bash
pnpm exec playwright test --debug e2e/specific-test.spec.ts
```

### Common Issues

**Issue: "BASE_URL is required"**

- Solution: Set `BASE_URL` environment variable or use default http://localhost:3000

**Issue: "Test timeout exceeded"**

- Solution: Increase timeout with `test.setTimeout(90000)` or ensure app is running

**Issue: "Element not found"**

- Solution: Check selector syntax, verify element exists in UI, add wait conditions

**Issue: "Authentication failed"**

- Solution: Verify `E2E_EMAIL` and `E2E_PASSWORD` are correct and account exists

## Performance Optimization

### Parallel Execution

Configure in `playwright.config.ts`:

```typescript
export default defineConfig({
  workers: 4, // Run 4 tests in parallel
  fullyParallel: true,
});
```

**Note:** Current config uses `workers: 1` and `fullyParallel: false` to avoid race conditions during development.

### Test Isolation

Each test runs in a fresh browser context to ensure isolation. Avoid:

- Shared state between tests
- Order-dependent tests
- Side effects that persist across tests

## Continuous Integration

### GitHub Actions Workflow

The CI validates all test specs on every PR:

```yaml
- name: Verify E2E test specs are valid
  run: pnpm --filter @llm-boost/web exec playwright test e2e/*.spec.ts --list
```

### Future: Dedicated E2E Workflow

Create `.github/workflows/e2e.yml` for full test execution against deployed previews:

```yaml
name: E2E Tests

on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @llm-boost/web exec playwright install chromium

      - name: Run E2E tests
        env:
          BASE_URL: ${{ github.event.deployment_status.target_url }}
          E2E_EMAIL: ${{ secrets.E2E_EMAIL }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
          E2E_PROJECT_ID: ${{ secrets.E2E_PROJECT_ID }}
        run: pnpm --filter @llm-boost/web exec playwright test
```

## Test Maintenance

### Regular Updates

1. **After UI changes**: Update selectors and assertions
2. **New features**: Add corresponding test specs
3. **Deprecated features**: Remove or update obsolete tests
4. **Breaking changes**: Update environment variable usage

### Coverage Goals

- **Critical paths**: 100% coverage (billing, crawls, projects)
- **Secondary features**: 80%+ coverage (reports, competitors, integrations)
- **Edge cases**: Test error states and validation

### Review Checklist

- [ ] Tests pass locally with default config
- [ ] Tests handle missing env vars gracefully
- [ ] Timeouts are appropriate for operations
- [ ] Selectors use semantic roles (button, link, heading)
- [ ] Assertions are specific and meaningful
- [ ] Test names clearly describe user actions
- [ ] Documentation is updated
