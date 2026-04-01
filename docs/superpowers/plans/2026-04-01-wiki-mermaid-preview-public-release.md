# Wiki Mermaid Preview Public Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the extension from an internal fixed-domain build into a public-safe release that requests site access at runtime and dynamically registers its content script.

**Architecture:** The public release removes fixed host permissions and static content script injection from the manifest. A background service worker will manage optional host permissions and dynamic content script registration, while the options page will manage both selector rules and authorized site patterns. Shared storage helpers will own migration from internal defaults to generic defaults so runtime scanning logic can remain mostly unchanged.

**Tech Stack:** TypeScript, Vite, `@crxjs/vite-plugin`, Chrome Manifest V3, Chrome `permissions` API, Chrome `scripting` API, Mermaid, Vitest, Testing Library, jsdom

---

## File Structure

- Modify: `manifest.config.ts`
- Modify: `README.md`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/default-rules.ts`
- Modify: `src/shared/storage.ts`
- Modify: `src/options/app.ts`
- Modify: `src/options/style.css`
- Modify: `tests/shared/storage.test.ts`
- Modify: `tests/options/app.test.ts`
- Modify: `tests/shared/url-match.test.ts`
- Create: `src/background/main.ts`
- Create: `src/shared/match-pattern.ts`
- Create: `src/shared/site-access.ts`
- Create: `src/shared/content-script-registration.ts`
- Create: `tests/background/main.test.ts`
- Create: `tests/shared/match-pattern.test.ts`

## Responsibility Map

- `manifest.config.ts`: public-safe manifest using optional host permissions and background service worker
- `src/background/main.ts`: startup registration and site access update orchestration
- `src/shared/types.ts`: shared types for selector rules and authorized site patterns
- `src/shared/default-rules.ts`: generic selector rule presets with no company-specific domains
- `src/shared/match-pattern.ts`: validate Chrome-style match patterns before requesting permissions
- `src/shared/site-access.ts`: storage helpers for authorized site patterns
- `src/shared/content-script-registration.ts`: wrapper around `chrome.scripting.registerContentScripts` and `unregisterContentScripts`
- `src/shared/storage.ts`: selector rule storage plus migration from internal domain defaults to public-safe defaults
- `src/options/app.ts`: add site-access UI and wire add/remove flows
- `README.md`: public setup instructions without company-specific references
- `tests/*`: regression coverage for migration, validation, options behavior, and background registration

### Task 1: Convert Manifest And Runtime Registration

**Files:**
- Modify: `manifest.config.ts`
- Create: `src/background/main.ts`
- Create: `src/shared/content-script-registration.ts`
- Test: `tests/background/main.test.ts`

- [ ] **Step 1: Write the failing background registration test**

```ts
import { describe, expect, it, vi } from "vitest"

describe("bootstrapRegistration", () => {
  it("registers the content script for all authorized patterns on startup", async () => {
    const registerContentScripts = vi.fn()
    const unregisterContentScripts = vi.fn()
    const getSiteAccessPatterns = vi.fn().mockResolvedValue([
      { id: "site-1", pattern: "http://example.com/*" },
      { id: "site-2", pattern: "https://wiki.example.com/*" }
    ])

    await bootstrapRegistration({
      getSiteAccessPatterns,
      registerContentScripts,
      unregisterContentScripts
    })

    expect(unregisterContentScripts).toHaveBeenCalledWith(["wiki-mermaid-preview-content"])
    expect(registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "wiki-mermaid-preview-content",
        matches: ["http://example.com/*", "https://wiki.example.com/*"]
      })
    ])
  })
})
```

- [ ] **Step 2: Run the targeted background test to verify it fails**

Run: `npm test -- tests/background/main.test.ts`
Expected: FAIL because `src/background/main.ts` and registration helpers do not exist yet

- [ ] **Step 3: Implement dynamic content script registration**

```ts
// src/shared/content-script-registration.ts
const registrationId = "wiki-mermaid-preview-content"

export async function refreshRegisteredContentScripts(patterns: string[]): Promise<void> {
  await chrome.scripting.unregisterContentScripts({ ids: [registrationId] }).catch(() => undefined)

  if (patterns.length === 0) {
    return
  }

  await chrome.scripting.registerContentScripts([
    {
      id: registrationId,
      matches: patterns,
      js: ["src/content/main.ts"],
      css: ["src/content/style.css"],
      runAt: "document_idle"
    }
  ])
}
```

```ts
// src/background/main.ts
import { getSiteAccessPatterns } from "../shared/site-access"
import { refreshRegisteredContentScripts } from "../shared/content-script-registration"

export async function bootstrapRegistration(): Promise<void> {
  const patterns = (await getSiteAccessPatterns()).map((entry) => entry.pattern)
  await refreshRegisteredContentScripts(patterns)
}

void bootstrapRegistration()
```

```ts
// manifest.config.ts
export const extensionManifest = {
  manifest_version: 3,
  name: "Wiki Mermaid Preview",
  version: "0.1.0",
  description: "Render Mermaid previews below Mermaid code blocks on authorized sites.",
  permissions: ["storage", "permissions", "scripting"],
  optional_host_permissions: ["http://*/*", "https://*/*"],
  background: {
    service_worker: "src/background/main.ts",
    type: "module"
  },
  options_page: "options.html"
} as const
```

- [ ] **Step 4: Re-run the targeted background test**

Run: `npm test -- tests/background/main.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the runtime registration foundation**

```bash
git add manifest.config.ts src/background/main.ts src/shared/content-script-registration.ts tests/background/main.test.ts
git commit -m "feat: add runtime content script registration"
```

### Task 2: Add Public-Safe Storage And Pattern Validation

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/default-rules.ts`
- Modify: `src/shared/storage.ts`
- Create: `src/shared/match-pattern.ts`
- Create: `src/shared/site-access.ts`
- Test: `tests/shared/storage.test.ts`
- Test: `tests/shared/match-pattern.test.ts`

- [ ] **Step 1: Write failing tests for migration and site access storage**

```ts
it("normalizes legacy internal rule patterns to public-safe defaults", async () => {
  chrome.storage.sync.get = vi.fn().mockResolvedValue({
    selectorRules: [
      {
        id: "legacy",
        name: "Legacy",
        enabled: true,
        urlPatterns: ["http://internal.example/*"],
        containerSelector: "pre > code.language-mermaid",
        extractMode: "innerText",
        trimLines: false,
        removeEmptyLines: false
      }
    ]
  })

  const rules = await loadRules()
  expect(rules[0].urlPatterns).toEqual(["*://*/*"])
})

it("stores and returns authorized site access patterns", async () => {
  await saveSiteAccessPatterns([{ id: "site-1", pattern: "http://example.com/*" }])
  expect(await getSiteAccessPatterns()).toEqual([{ id: "site-1", pattern: "http://example.com/*" }])
})
```

- [ ] **Step 2: Run the focused shared tests to verify they fail**

Run: `npm test -- tests/shared/storage.test.ts tests/shared/match-pattern.test.ts`
Expected: FAIL because the new site access storage and match-pattern validation do not exist yet

- [ ] **Step 3: Implement public-safe defaults, migration, and match-pattern validation**

```ts
// src/shared/types.ts
export type SiteAccessPattern = {
  id: string
  pattern: string
}
```

```ts
// src/shared/default-rules.ts
urlPatterns: ["*://*/*"]
```

```ts
// src/shared/match-pattern.ts
const chromeMatchPattern = /^(\\*|https?|file):\\/\\/(\\*|\\*\\.[^/*]+|[^/*]+)?\\/.*$/

export function isValidMatchPattern(value: string): boolean {
  return chromeMatchPattern.test(value.trim())
}
```

```ts
// src/shared/site-access.ts
const storageKey = "siteAccessPatterns"

export async function getSiteAccessPatterns(): Promise<SiteAccessPattern[]> {
  const result = await chrome.storage.sync.get(storageKey)
  return Array.isArray(result[storageKey]) ? structuredClone(result[storageKey]) : []
}

export async function saveSiteAccessPatterns(patterns: SiteAccessPattern[]): Promise<void> {
  await chrome.storage.sync.set({ [storageKey]: structuredClone(patterns) })
}
```

```ts
// src/shared/storage.ts
function normalizeRule(rule: SelectorRule): SelectorRule {
  const isLegacyInternalOnly =
    rule.urlPatterns.length === 1 && rule.urlPatterns[0] === "http://internal.example/*"

  return {
    ...rule,
    urlPatterns: isLegacyInternalOnly ? ["*://*/*"] : [...rule.urlPatterns]
  }
}
```

- [ ] **Step 4: Re-run the focused shared tests**

Run: `npm test -- tests/shared/storage.test.ts tests/shared/match-pattern.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the public-safe storage layer**

```bash
git add src/shared/types.ts src/shared/default-rules.ts src/shared/storage.ts src/shared/match-pattern.ts src/shared/site-access.ts tests/shared/storage.test.ts tests/shared/match-pattern.test.ts
git commit -m "feat: add public-safe storage and pattern validation"
```

### Task 3: Add Site Access Management To The Options Page

**Files:**
- Modify: `src/options/app.ts`
- Modify: `src/options/style.css`
- Test: `tests/options/app.test.ts`

- [ ] **Step 1: Write the failing options-page test for adding site access**

```ts
it("adds an authorized site pattern after permission approval", async () => {
  chrome.permissions.request = vi.fn().mockResolvedValue(true)
  renderOptionsApp()

  await userEvent.type(screen.getByLabelText("Site pattern"), "http://example.com/*")
  await userEvent.click(screen.getByRole("button", { name: "Add Site" }))

  expect(chrome.permissions.request).toHaveBeenCalledWith({
    origins: ["http://example.com/*"]
  })
  expect(screen.getByText("http://example.com/*")).toBeTruthy()
})
```

- [ ] **Step 2: Run the options tests to verify they fail**

Run: `npm test -- tests/options/app.test.ts`
Expected: FAIL because the options UI does not yet expose site-access controls

- [ ] **Step 3: Implement the site-access section and permission flow**

```ts
// src/options/app.ts
const requestSiteAccess = async (pattern: string) => {
  const granted = await chrome.permissions.request({ origins: [pattern] })
  if (!granted) {
    return false
  }

  const nextPatterns = [...siteAccessPatterns, { id: createRuntimeId("site"), pattern }]
  await saveSiteAccessPatterns(nextPatterns)
  await refreshRegisteredContentScripts(nextPatterns.map((entry) => entry.pattern))
  siteAccessPatterns = nextPatterns
  return true
}
```

```ts
// rendered section outline
<section class="wmp-site-access">
  <h2>Site Access</h2>
  <label>Site pattern</label>
  <input />
  <button>Add Site</button>
  <ul>
    <li>
      <span>http://example.com/*</span>
      <button>Remove</button>
    </li>
  </ul>
</section>
```

- [ ] **Step 4: Re-run the options tests**

Run: `npm test -- tests/options/app.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the public options flow**

```bash
git add src/options/app.ts src/options/style.css tests/options/app.test.ts
git commit -m "feat: add runtime site access controls"
```

### Task 4: Remove Company-Specific References And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `tests/shared/url-match.test.ts`
- Modify: `docs/superpowers/specs/2026-04-01-wiki-mermaid-preview-design.md`
- Modify: `docs/superpowers/plans/2026-04-01-wiki-mermaid-preview.md`

- [ ] **Step 1: Replace company-specific examples with public-safe examples**

```md
Use match patterns such as:

- `http://example.com/*`
- `https://wiki.example.com/*`
```

```ts
expect(urlMatchesAnyPattern("http://example.com/pages/1", ["http://example.com/*"])).toBe(true)
```

- [ ] **Step 2: Run a repository-wide leak check**

Run: `rg -n "wiki\\.gf\\.com\\.cn|gf\\.com\\.cn" .`
Expected: only intentional migration notes in the new public-release spec, or zero matches if those notes are removed during cleanup

- [ ] **Step 3: Run the full verification suite**

Run: `npm test`
Expected: all test files pass

Run: `npm run build`
Expected: build succeeds and `dist/manifest.json` contains no company-specific domain

Run: `rg -n "wiki\\.gf\\.com\\.cn|gf\\.com\\.cn" dist manifest.config.ts README.md src tests`
Expected: zero matches

- [ ] **Step 4: Commit the public release cleanup**

```bash
git add README.md tests/shared/url-match.test.ts docs/superpowers/specs/2026-04-01-wiki-mermaid-preview-design.md docs/superpowers/plans/2026-04-01-wiki-mermaid-preview.md
git commit -m "chore: remove internal domain references"
```
