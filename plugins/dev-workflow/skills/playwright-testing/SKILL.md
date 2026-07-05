---
name: playwright-testing
description: Use when writing, running, or debugging Playwright tests against a web application (not Tauri/desktop apps — see tauri-playwright for that), or when driving a live browser to verify or demo a feature. Covers locator strategy, waiting, network mocking, debugging failures, and delegating test runs to a subagent so verbose output stays out of the main session.
---

# Playwright Testing

Practical tips for writing and running Playwright tests (or ad-hoc browser automation) against an ordinary web application. For Tauri/WebView desktop apps, use the `tauri-playwright` skill instead — this one assumes a normal browser context.

## Locator strategy

Prefer role/text/label-based locators over CSS/XPath — they survive markup churn and read like what a user actually sees:

```ts
// Prefer
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Email address')
page.getByText('Order confirmed')

// Avoid — brittle, breaks on any class/DOM restructure
page.locator('.btn.btn-primary.submit-btn')
page.locator('//div[3]/span[2]')
```

When driving a browser interactively (not writing a `.spec.ts` file), use the Playwright MCP `browser_snapshot` tool to get the accessibility tree instead of a screenshot — it gives you stable element refs to click/type into, where a screenshot only gives you pixels.

## Waiting

Playwright auto-waits for actionability (visible, enabled, stable) before most actions. Let it:

```ts
// Prefer — retries until it passes or times out
await expect(page.getByText('Saved')).toBeVisible();

// Avoid — arbitrary, either too slow or flaky
await page.waitForTimeout(2000);
```

If a wait genuinely needs a custom condition (e.g. waiting on an app-specific ready flag), poll a condition rather than sleeping a fixed duration — see the `systematic-debugging` skill's condition-based-waiting notes for the general pattern.

## Debugging failures

| Tool | When to use |
|------|-------------|
| `trace: 'on-first-retry'` in `playwright.config.ts` | Always on for CI — gives you a full trace (DOM snapshots, network, console) for any test that failed once and passed on retry |
| `npx playwright test --debug` | Step through a single test locally with the inspector |
| `npx playwright test --ui` | Interactive UI mode — timeline, watch mode, pick locators |
| `PWDEBUG=1 npx playwright test` | Opens Playwright Inspector for every test in the run |
| `video: 'retain-on-failure'` | Cheaper than trace, good enough for "what did the page look like" |

## Network

Mock or stub network calls for deterministic tests instead of hitting real backends:

```ts
await page.route('**/api/orders', route =>
  route.fulfill({ json: { orders: [] } })
);
```

Don't wait on `networkidle` as a proxy for "page is ready" — it's unreliable with polling, websockets, or analytics beacons that never go idle. Wait for the specific element or response you actually need instead.

## Test isolation

- Use fixtures for setup/teardown, not shared module-level state.
- Give each test its own data (unique emails, IDs) so tests can run in parallel without colliding.
- Don't depend on test execution order.

## CI config

```ts
export default defineConfig({
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
});
```

Headless in CI, headed locally when debugging (`--headed` flag or `use: { headless: false }`).

## Delegate execution to a subagent

Don't run Playwright test suites or long browser-driving sequences inline in the top-level session — the tool output (console logs, network traces, retries) floods context for no benefit. Dispatch to a subagent instead and bring back only a summary:

```
if 'playwright-runner' is an available agent type:
    Agent(subagent_type='playwright-runner', description='Run <suite/feature> tests',
          prompt='<what to run and what to report back>')
else:
    Agent(subagent_type='general-purpose', description='Run <suite/feature> tests',
          prompt='Run `<test command>` in <project dir>. Report back only: '
                 'pass/fail counts, names of any failing tests, the key error line '
                 'for each failure, and paths to any trace/video/screenshot artifacts. '
                 'Do not paste full raw logs.')
```

The `playwright-runner` subagent (shipped with this plugin) is scoped to exactly the tools this needs — `Bash`, `Read`, `Grep`, `Glob`, and the Playwright MCP browser tools — and is instructed to report concisely rather than dump logs.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Test passes locally, flakes in CI | Almost always a timing assumption — replace any `waitForTimeout` with a condition-based `expect(...)` |
| Selector breaks after a UI tweak | Switch to role/label/text locators so only genuinely user-visible changes break the test |
| Tests interfere with each other when run in parallel | Check for shared fixtures/global state or hardcoded test data (same email/ID reused across tests) |
| `browser_snapshot` output is huge | Scope to a specific frame/element ref rather than the whole page when you already know where you're looking |
