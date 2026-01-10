# Playwright Complete Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Migrate all web-browser tools from Puppeteer to Playwright and add API testing capabilities.

**Architecture:** Replace puppeteer-core with playwright, update all existing tools (start.js, nav.js, a11y.js, network.js), and add new api.js for HAR-based API testing.

**Tech Stack:** Playwright (JavaScript library), Node.js ESM, HAR 1.2 specification, Chrome CDP connection

---

## Task 1: Update Dependencies and Install Playwright

**Files:**
- Modify: `users/shared/.config/claude/skills/web-browser/tools/package.json`

**Requirements:**
1. Replace `puppeteer-core` with `playwright` in package.json
2. Install dependencies with npm install
3. Verify Playwright installation
4. Commit the dependency change

**Steps:**

```json
{
  "type": "module",
  "dependencies": {
    "playwright": "^1.49.0"
  }
}
```

**Testing:**
- Run `npm list playwright` to verify installation
- Should show playwright@1.49.0 or similar

**Commit message:**
```
build: migrate from puppeteer-core to playwright

Replace puppeteer-core with playwright for better CDP support
and unified API across browser automation tasks.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 2: Migrate start.js to Playwright

**Files:**
- Modify: `users/shared/.config/claude/skills/web-browser/tools/start.js`

**Requirements:**
1. Replace `import puppeteer from "puppeteer-core"` with `import { chromium } from "playwright"`
2. Replace `puppeteer.connect()` with `chromium.connectOverCDP()`
3. Update connection URL format
4. Test that Chrome starts and connects successfully
5. Commit the changes

**Key changes:**

```javascript
// Before
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({
  browserURL: "http://localhost:9222",
  defaultViewport: null,
});

// After
import { chromium } from "playwright";
const browser = await chromium.connectOverCDP("http://localhost:9222");
```

**Testing:**
- Run `./start.js` and verify Chrome starts
- Check that "✓ Chrome started on :9222" message appears
- Verify Chrome is accessible on localhost:9222

**Commit message:**
```
refactor: migrate start.js to playwright

Update Chrome connection logic to use Playwright's CDP API.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 3: Migrate nav.js to Playwright

**Files:**
- Modify: `users/shared/.config/claude/skills/web-browser/tools/nav.js`

**Requirements:**
1. Replace puppeteer imports with playwright
2. Update connection logic to use `chromium.connectOverCDP()`
3. Update page access to use Playwright's context API
4. Test navigation works in both current tab and new tab modes
5. Commit the changes

**Key changes:**

```javascript
// Before
import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({
  browserURL: "http://localhost:9222",
  defaultViewport: null,
});
const p = (await b.pages()).at(-1);

// After
import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const contexts = b.contexts();
const p = contexts[0].pages().at(-1);
```

**Testing:**
- Run `./nav.js https://example.com` and verify navigation
- Run `./nav.js https://example.com --new` and verify new tab opens
- Check success messages appear correctly

**Commit message:**
```
refactor: migrate nav.js to playwright

Update navigation logic to use Playwright's CDP and context APIs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 4: Migrate network.js to Playwright

**Files:**
- Modify: `users/shared/.config/claude/skills/web-browser/tools/network.js`

**Requirements:**
1. Replace puppeteer imports with playwright
2. Update connection logic to use `chromium.connectOverCDP()`
3. Update page access to use Playwright's context API
4. Ensure request/response event handlers work with Playwright
5. Test network monitoring with and without filters
6. Commit the changes

**Key changes:**

```javascript
// Before
import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({
  browserURL: "http://localhost:9222",
  defaultViewport: null,
});
const p = (await b.pages()).at(-1);

// After
import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const contexts = b.contexts();
const p = contexts[0].pages().at(-1);
```

**Testing:**
- Run `./network.js` and verify requests are captured
- Run `./network.js --filter=example` and verify filtering works
- Press Ctrl+C and verify summary displays correctly

**Commit message:**
```
refactor: migrate network.js to playwright

Update network monitoring to use Playwright's CDP and context APIs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 5: Migrate a11y.js to Playwright

**Files:**
- Modify: `users/shared/.config/claude/skills/web-browser/tools/a11y.js`

**Requirements:**
1. Replace puppeteer imports with playwright
2. Update connection logic to use `chromium.connectOverCDP()`
3. Replace `page.accessibility.snapshot()` with Playwright's accessibility API
4. Implement tree traversal using `locator.accessibility()` for individual elements
5. Test accessibility tree display with and without role filters
6. Commit the changes

**Note:** Playwright doesn't have a direct equivalent to Puppeteer's `page.accessibility.snapshot()`. We need to use a different approach:
- Use `page.locator('body')` to get the root element
- Use `locator.accessibility()` to get accessibility info for specific elements
- Build the tree by querying child elements recursively

**Alternative approach (simpler):**
Use Playwright's `page.accessibility.snapshot()` API which is available via the CDP session.

**Testing:**
- Run `./a11y.js` and verify accessibility tree displays
- Run `./a11y.js --role=button` and verify filtering works
- Verify summary shows role counts correctly

**Commit message:**
```
refactor: migrate a11y.js to playwright

Update accessibility tree capture to use Playwright's APIs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 6: Create API Testing Tool (api.js)

**Files:**
- Create: `users/shared/.config/claude/skills/web-browser/tools/api.js`

**Requirements:**
1. Create new api.js with help output and basic structure
2. Implement Chrome CDP connection using Playwright
3. Implement request/response capture for XHR and Fetch
4. Add URL pattern filtering support
5. Add custom output filename support
6. Implement HAR 1.2 format export
7. Test all features work correctly
8. Commit the implementation

**Implementation:**

```javascript
#!/usr/bin/env node

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const command = process.argv[2];

if (command === "--help" || !command) {
  console.log("Usage: api.js <command> [options]");
  console.log("\nCommands:");
  console.log("  capture  Capture API requests and save to HAR file");
  console.log("\nOptions:");
  console.log("  --filter=<pattern>  Only capture URLs matching pattern");
  console.log("  --output=<file>     Output filename (default: api-requests.har)");
  console.log("  --help              Show this help message");
  process.exit(0);
}

if (command === "capture") {
  const filterPattern = process.argv.find(arg => arg.startsWith("--filter="))?.split("=")[1];
  const outputFile = process.argv.find(arg => arg.startsWith("--output="))?.split("=")[1] || "api-requests.har";

  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      console.error("✗ No browser contexts found");
      process.exit(1);
    }

    const context = contexts[0];
    const pages = context.pages();

    if (pages.length === 0) {
      console.error("✗ No active tabs found");
      process.exit(1);
    }

    const page = pages[pages.length - 1];
    console.log("✓ Connected to Chrome on :9222");

    const requests = [];

    // Capture requests
    page.on('request', request => {
      const url = request.url();
      const resourceType = request.resourceType();

      // Only capture XHR/Fetch (API calls)
      if (!['xhr', 'fetch'].includes(resourceType)) {
        return;
      }

      // Apply filter if specified
      if (filterPattern && !url.includes(filterPattern)) {
        return;
      }

      const requestData = {
        url: url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        resourceType: resourceType,
        timestamp: new Date().toISOString(),
      };

      requests.push(requestData);
      console.log(`📥 [${requestData.method}] ${url}`);
    });

    // Capture responses
    page.on('response', async response => {
      const url = response.url();
      const request = requests.find(r => r.url === url);

      if (!request) return;

      try {
        request.status = response.status();
        request.statusText = response.statusText();
        request.responseHeaders = response.headers();

        // Try to get response body
        const body = await response.body();
        request.responseBody = body.toString('base64');
        request.responseSize = body.length;

        console.log(`📤 [${request.status}] ${url}`);
      } catch (err) {
        console.log(`⚠️  Failed to capture response: ${url}`);
      }
    });

    console.log("\n🔍 Capturing API requests... (Press Ctrl+C to stop and save)\n");
    if (filterPattern) {
      console.log(`   Filter: ${filterPattern}`);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n\n💾 Saving captured requests...");

      const har = toHAR(requests);
      writeFileSync(outputFile, JSON.stringify(har, null, 2));

      console.log(`✓ Saved ${requests.length} requests to ${outputFile}`);
      console.log(`  Format: HAR 1.2`);
      console.log(`\nSummary:`);
      console.log(`  Total requests: ${requests.length}`);

      const methods = requests.reduce((acc, req) => {
        acc[req.method] = (acc[req.method] || 0) + 1;
        return acc;
      }, {});

      console.log(`  By method:`);
      Object.entries(methods).forEach(([method, count]) => {
        console.log(`    ${method}: ${count}`);
      });

      await browser.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("✗ Failed to connect to Chrome on :9222");
    console.error("  Make sure Chrome is running with:");
    console.error("  ./start.js");
    process.exit(1);
  }
}

// Convert captured requests to HAR 1.2 format
function toHAR(requests) {
  return {
    log: {
      version: "1.2",
      creator: {
        name: "web-browser-api-tool",
        version: "1.0.0"
      },
      browser: {
        name: "Chrome",
        version: "Unknown"
      },
      pages: [],
      entries: requests.map(req => ({
        startedDateTime: req.timestamp,
        time: 0,
        request: {
          method: req.method,
          url: req.url,
          httpVersion: "HTTP/1.1",
          headers: Object.entries(req.headers || {}).map(([name, value]) => ({
            name,
            value: String(value)
          })),
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: req.postData ? req.postData.length : -1,
          postData: req.postData ? {
            mimeType: req.headers?.['content-type'] || 'application/octet-stream',
            text: req.postData
          } : undefined
        },
        response: {
          status: req.status || 0,
          statusText: req.statusText || '',
          httpVersion: "HTTP/1.1",
          headers: Object.entries(req.responseHeaders || {}).map(([name, value]) => ({
            name,
            value: String(value)
          })),
          cookies: [],
          content: {
            size: req.responseSize || 0,
            compression: 0,
            mimeType: req.responseHeaders?.['content-type'] || 'application/octet-stream',
            text: req.responseBody || '',
            encoding: 'base64'
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: req.responseSize || -1
        },
        cache: {},
        timings: {
          blocked: -1,
          dns: -1,
          connect: -1,
          send: -1,
          wait: -1,
          receive: -1,
          ssl: -1
        }
      }))
    }
  };
}

if (!["capture"].includes(command)) {
  console.error("Unknown command:", command);
  process.exit(1);
}
```

**Testing:**
- Run `./api.js --help` and verify help output
- Start Chrome with `./start.js`
- Navigate to a test page with `./nav.js https://jsonplaceholder.typicode.com`
- Run `./api.js capture` and trigger some API calls
- Press Ctrl+C and verify HAR file is created
- Validate HAR format with `cat api-requests.har | jq '.log.version'` (should be "1.2")

**Commit message:**
```
feat: add api.js for HAR-based API testing

Implement API request capture tool using Playwright CDP connection.
Captures XHR/Fetch requests, saves in HAR 1.2 format with filtering
and custom output support.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 7: Update SKILL.md Documentation

**Files:**
- Modify: `users/shared/.config/claude/skills/web-browser/SKILL.md`

**Requirements:**
1. Add API Testing section after existing sections
2. Document api.js usage with examples
3. Explain HAR format and use cases
4. Commit documentation update

**Content to add:**

```markdown
## API Testing

```bash
./tools/api.js capture
./tools/api.js capture --filter=api.example.com
./tools/api.js capture --output=custom.har
```

Capture API requests (XHR/Fetch) and save to HAR 1.2 format. Filter by URL pattern. Press Ctrl+C to stop and save. HAR files can be analyzed with browser DevTools or replayed with Playwright.
```

**Commit message:**
```
docs: add API testing documentation to SKILL.md

Document api.js usage, examples, and HAR format explanation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 8: Commit Existing Untracked Files

**Files:**
- Add: `users/shared/.config/claude/skills/web-browser/tools/a11y.js`
- Add: `users/shared/.config/claude/skills/web-browser/tools/network.js`
- Modify: `users/shared/.config/claude/skills/web-browser/SKILL.md`

**Requirements:**
1. Review current state of these files (already migrated to Playwright)
2. Commit all three files together
3. Use appropriate commit message

**Commit message:**
```
feat: add a11y.js and network.js tools, update SKILL.md

Add accessibility tree viewer and network monitor tools.
Update documentation with new tool descriptions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Task 9: Final Integration Test

**Files:**
- None (manual testing)

**Requirements:**
1. Verify all tools work with Playwright
2. Test each tool individually
3. Test api.js end-to-end workflow
4. Document any issues found

**Test script:**

```bash
# Test 1: Start Chrome
./start.js
# Expected: ✓ Chrome started on :9222

# Test 2: Navigate
./nav.js https://example.com
# Expected: ✓ Navigated to: https://example.com

# Test 3: Network monitoring
./network.js &
NETPID=$!
sleep 5
kill $NETPID
# Expected: Network requests logged

# Test 4: Accessibility tree
./a11y.js --role=link
# Expected: Links displayed with accessibility info

# Test 5: API capture
./nav.js https://jsonplaceholder.typicode.com
./api.js capture --filter=jsonplaceholder --output=test.har
# Trigger some API calls in browser
# Press Ctrl+C
# Expected: test.har created with valid HAR 1.2 format

# Validate HAR
cat test.har | jq '.log.version'
# Expected: "1.2"

cat test.har | jq '.log.entries | length'
# Expected: > 0

# Cleanup
rm test.har
```

**No commit needed** - this is verification only.

---

## Success Criteria

- [ ] Playwright dependency installed, puppeteer-core removed
- [ ] start.js works with Playwright
- [ ] nav.js works with Playwright
- [ ] network.js works with Playwright
- [ ] a11y.js works with Playwright
- [ ] api.js captures API requests
- [ ] HAR 1.2 format export works
- [ ] URL filtering works
- [ ] Documentation updated
- [ ] All files committed
- [ ] Integration tests pass

## Notes

- **Migration strategy**: Update imports and connection logic consistently across all files
- **CDP compatibility**: Playwright's `connectOverCDP()` is compatible with Chrome's debug port
- **Context API**: Playwright uses browser contexts, access pages via `contexts[0].pages()`
- **Accessibility**: Playwright may have limited accessibility snapshot API compared to Puppeteer
- **HAR format**: Industry standard for HTTP archive, compatible with browser DevTools

## Future Enhancements (Not in Scope)

- HAR replay using `page.routeFromHAR()`
- Request timing analysis
- Sensitive header masking
- Visual HAR analyzer
