# Wiki Mermaid Preview Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension for a legacy internal wiki host such as `http://internal.example/*` that detects Mermaid source blocks across multiple DOM shapes, preserves the original code block, and inserts a rendered preview below it with rule configuration stored in extension options.

**Architecture:** The extension uses a static content script for page scanning and rendering, a small options page for rule management, and shared TypeScript modules for rule storage, extraction, Mermaid detection, and preview insertion. The first implementation keeps host permissions narrow, avoids background-script complexity, and relies on idempotent DOM markers plus a debounced `MutationObserver` for dynamic wiki content.

**Tech Stack:** TypeScript, Vite, `@crxjs/vite-plugin`, Chrome Manifest V3, Mermaid, Vitest, Testing Library, jsdom

---

## File Structure

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `manifest.config.ts`
- Create: `options.html`
- Create: `src/content/main.ts`
- Create: `src/content/style.css`
- Create: `src/options/main.ts`
- Create: `src/options/style.css`
- Create: `src/options/app.ts`
- Create: `src/shared/types.ts`
- Create: `src/shared/default-rules.ts`
- Create: `src/shared/storage.ts`
- Create: `src/shared/url-match.ts`
- Create: `src/shared/extract.ts`
- Create: `src/shared/mermaid-detect.ts`
- Create: `src/shared/dom-markers.ts`
- Create: `src/shared/preview.ts`
- Create: `src/shared/scan.ts`
- Create: `tests/setup.ts`
- Create: `tests/shared/extract.test.ts`
- Create: `tests/shared/mermaid-detect.test.ts`
- Create: `tests/shared/url-match.test.ts`
- Create: `tests/shared/scan.test.ts`
- Create: `README.md`

### Responsibility Map

- `src/shared/types.ts`: shared rule and storage types
- `src/shared/default-rules.ts`: built-in selector rules for known wiki structures
- `src/shared/storage.ts`: read and write rules from `chrome.storage.sync`
- `src/shared/url-match.ts`: Chrome-style match pattern filtering for current page URL
- `src/shared/extract.ts`: normalize Mermaid source for `innerText`, `joinChildrenText`, and `auto`
- `src/shared/mermaid-detect.ts`: detect likely Mermaid content before render
- `src/shared/dom-markers.ts`: processed-node and preview-node constants
- `src/shared/preview.ts`: create preview shell, render Mermaid, and show errors
- `src/shared/scan.ts`: scan the page, skip duplicates, and hook mutation handling
- `src/content/main.ts`: content-script bootstrap
- `src/options/app.ts`: options-page UI and rule form logic
- `tests/*`: unit and DOM coverage for extraction, detection, URL filtering, and idempotent scan behavior

### Task 1: Scaffold The Extension Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `manifest.config.ts`
- Create: `options.html`
- Create: `tests/setup.ts`
- Create: `README.md`

- [ ] **Step 1: Write the failing tooling smoke test by defining expected scripts and dependencies in `README.md`**

```md
## Expected Local Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test`

## Expected Build Output

After `npm run build`, the project should produce a loadable Chrome extension bundle with:

- a manifest declaring a legacy internal host pattern such as `http://internal.example/*`
- a content script entry
- an options page entry
```

- [ ] **Step 2: Create project metadata and build scripts in `package.json`**

```json
{
  "name": "wiki-mermaid-preview",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "mermaid": "^11.6.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.30",
    "@testing-library/dom": "^10.4.0",
    "@types/chrome": "^0.0.321",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.2",
    "vite": "^6.2.0",
    "vitest": "^3.0.8"
  }
}
```

- [ ] **Step 3: Add TypeScript, Vite, Vitest, and manifest configuration**

```ts
// manifest.config.ts
export const extensionManifest = {
  manifest_version: 3,
  name: "Wiki Mermaid Preview",
  version: "0.1.0",
  description: "Render Mermaid previews below code blocks on a legacy internal wiki host",
  permissions: ["storage"],
  host_permissions: ["http://internal.example/*"],
  content_scripts: [
    {
      matches: ["http://internal.example/*"],
      js: ["src/content/main.ts"],
      css: ["src/content/style.css"],
      run_at: "document_idle"
    }
  ],
  options_page: "options.html"
} as const
```

```ts
// vite.config.ts
import { crx } from "@crxjs/vite-plugin"
import { defineConfig } from "vite"
import { extensionManifest } from "./manifest.config"

export default defineConfig({
  plugins: [crx({ manifest: extensionManifest as chrome.runtime.Manifest })]
})
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"]
  }
})
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "lib": ["DOM", "ES2022"],
    "types": ["chrome", "vite/client"]
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts", "vitest.config.ts"]
}
```

```html
<!-- options.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wiki Mermaid Preview Options</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/options/main.ts"></script>
  </body>
</html>
```

```ts
// tests/setup.ts
import { afterEach } from "vitest"

afterEach(() => {
  document.body.innerHTML = ""
})
```

- [ ] **Step 4: Run install and verify the project builds without application code yet**

Run: `npm install`
Expected: packages install successfully and `package-lock.json` is created

Run: `npm run build`
Expected: Vite completes without TypeScript errors, even if the output is still minimal

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts manifest.config.ts options.html tests/setup.ts README.md
git commit -m "chore: scaffold wiki mermaid preview extension"
```

### Task 2: Implement Rule Types, Storage, URL Matching, And Extraction Utilities

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/default-rules.ts`
- Create: `src/shared/storage.ts`
- Create: `src/shared/url-match.ts`
- Create: `src/shared/extract.ts`
- Create: `src/shared/mermaid-detect.ts`
- Create: `src/shared/dom-markers.ts`
- Test: `tests/shared/extract.test.ts`
- Test: `tests/shared/mermaid-detect.test.ts`
- Test: `tests/shared/url-match.test.ts`

- [ ] **Step 1: Write failing unit tests for extraction, detection, and URL matching**

```ts
// tests/shared/extract.test.ts
import { describe, expect, it } from "vitest"
import { extractMermaidSource } from "../../src/shared/extract"

describe("extractMermaidSource", () => {
  it("joins line elements when auto mode finds child lines", () => {
    const container = document.createElement("div")
    container.innerHTML = `
      <div class="line">erDiagram</div>
      <div class="line">A ||--o{ B : maps</div>
    `

    expect(
      extractMermaidSource(container, {
        extractMode: "auto",
        lineSelector: ".line",
        trimLines: true,
        removeEmptyLines: false
      })
    ).toBe("erDiagram\nA ||--o{ B : maps")
  })
})
```

```ts
// tests/shared/mermaid-detect.test.ts
import { describe, expect, it } from "vitest"
import { looksLikeMermaid } from "../../src/shared/mermaid-detect"

describe("looksLikeMermaid", () => {
  it("accepts erDiagram blocks", () => {
    expect(looksLikeMermaid("erDiagram\nA ||--o{ B : maps")).toBe(true)
  })

  it("rejects plain sql", () => {
    expect(looksLikeMermaid("select * from trade_deal")).toBe(false)
  })
})
```

```ts
// tests/shared/url-match.test.ts
import { describe, expect, it } from "vitest"
import { urlMatchesAnyPattern } from "../../src/shared/url-match"

describe("urlMatchesAnyPattern", () => {
  it("matches the internal wiki host", () => {
    expect(
      urlMatchesAnyPattern("http://internal.example/pages/viewpage.action?id=1", [
        "http://internal.example/*"
      ])
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Implement shared types, defaults, and DOM marker constants**

```ts
// src/shared/types.ts
export type ExtractMode = "auto" | "innerText" | "joinChildrenText"

export type SelectorRule = {
  id: string
  name: string
  enabled: boolean
  urlPatterns: string[]
  containerSelector: string
  extractMode: ExtractMode
  lineSelector?: string
  trimLines: boolean
  removeEmptyLines: boolean
}
```

```ts
// src/shared/default-rules.ts
import type { SelectorRule } from "./types"

export const defaultRules: SelectorRule[] = [
  {
    id: "confluence-line-by-line",
    name: "Confluence line-by-line Mermaid",
    enabled: true,
    urlPatterns: ["http://internal.example/*"],
    containerSelector: 'div.code[data-macro-name="code"] td.code > div.container',
    extractMode: "auto",
    lineSelector: ".line",
    trimLines: true,
    removeEmptyLines: false
  },
  {
    id: "code-tag-language-mermaid",
    name: "Code tag Mermaid block",
    enabled: true,
    urlPatterns: ["http://internal.example/*"],
    containerSelector: "pre > code.language-mermaid",
    extractMode: "innerText",
    trimLines: false,
    removeEmptyLines: false
  }
]
```

```ts
// src/shared/dom-markers.ts
export const processedMarker = "data-wiki-mermaid-preview-processed"
export const previewClassName = "wmp-preview"
```

- [ ] **Step 3: Implement storage, URL matching, extraction, and Mermaid detection**

```ts
// src/shared/storage.ts
import { defaultRules } from "./default-rules"
import type { SelectorRule } from "./types"

const storageKey = "selectorRules"

export async function loadRules(): Promise<SelectorRule[]> {
  const result = await chrome.storage.sync.get(storageKey)
  const savedRules = result[storageKey] as SelectorRule[] | undefined
  return savedRules && savedRules.length > 0 ? savedRules : defaultRules
}

export async function saveRules(rules: SelectorRule[]): Promise<void> {
  await chrome.storage.sync.set({ [storageKey]: rules })
}
```

```ts
// src/shared/url-match.ts
export function urlMatchesAnyPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
    return new RegExp(`^${escaped}$`).test(url)
  })
}
```

```ts
// src/shared/extract.ts
import type { SelectorRule } from "./types"

function normalizeLines(lines: string[], rule: Pick<SelectorRule, "trimLines" | "removeEmptyLines">) {
  const normalized = lines.map((line) => (rule.trimLines ? line.trim() : line))
  return rule.removeEmptyLines ? normalized.filter((line) => line.length > 0) : normalized
}

export function extractMermaidSource(
  container: Element,
  rule: Pick<SelectorRule, "extractMode" | "lineSelector" | "trimLines" | "removeEmptyLines">
): string {
  const childLines =
    rule.lineSelector && (rule.extractMode === "auto" || rule.extractMode === "joinChildrenText")
      ? Array.from(container.querySelectorAll<HTMLElement>(rule.lineSelector)).map((node) => node.innerText)
      : []

  if (childLines.length > 0) {
    return normalizeLines(childLines, rule).join("\n")
  }

  return normalizeLines(container.innerText.split("\n"), rule).join("\n")
}
```

```ts
// src/shared/mermaid-detect.ts
const mermaidPrefixes = [
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "gitGraph",
  "kanban",
  "architecture-beta"
]

export function looksLikeMermaid(source: string): boolean {
  const normalized = source.trimStart()
  return mermaidPrefixes.some((prefix) => normalized.startsWith(prefix))
}
```

- [ ] **Step 4: Run the shared test suite and make sure it passes**

Run: `npm run test -- tests/shared/extract.test.ts tests/shared/mermaid-detect.test.ts tests/shared/url-match.test.ts`
Expected: all three test files pass with green output

- [ ] **Step 5: Commit the shared foundation**

```bash
git add src/shared tests/shared
git commit -m "feat: add mermaid rule extraction foundation"
```

### Task 3: Build Content Script Scanning, Preview Insertion, And Mermaid Rendering

**Files:**
- Create: `src/content/main.ts`
- Create: `src/content/style.css`
- Create: `src/shared/preview.ts`
- Create: `src/shared/scan.ts`
- Test: `tests/shared/scan.test.ts`

- [ ] **Step 1: Write failing DOM tests for scan idempotency and preview insertion**

```ts
// tests/shared/scan.test.ts
import { describe, expect, it, vi } from "vitest"
import { processedMarker, previewClassName } from "../../src/shared/dom-markers"
import { scanRoot } from "../../src/shared/scan"

vi.mock("../../src/shared/preview", () => ({
  renderPreviewBelow: vi.fn(async (container: Element) => {
    const preview = document.createElement("div")
    preview.className = "wmp-preview"
    container.insertAdjacentElement("afterend", preview)
  })
}))

describe("scanRoot", () => {
  it("marks processed Mermaid containers and inserts one preview", async () => {
    document.body.innerHTML = `
      <div class="container">
        <div class="line">erDiagram</div>
        <div class="line">A ||--o{ B : maps</div>
      </div>
    `

    await scanRoot(document, [
      {
        id: "rule-1",
        name: "rule",
        enabled: true,
        urlPatterns: ["http://internal.example/*"],
        containerSelector: ".container",
        extractMode: "auto",
        lineSelector: ".line",
        trimLines: true,
        removeEmptyLines: false
      }
    ], "http://internal.example/pages/1")

    const container = document.querySelector(".container")
    expect(container?.getAttribute(processedMarker)).toBe("true")
    expect(document.querySelectorAll(`.${previewClassName}`)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Implement preview creation and Mermaid rendering helpers**

```ts
// src/shared/preview.ts
import mermaid from "mermaid"
import { previewClassName } from "./dom-markers"

export async function renderPreviewBelow(container: Element, source: string): Promise<void> {
  const wrapper = document.createElement("div")
  wrapper.className = previewClassName
  wrapper.innerHTML = `
    <div class="wmp-preview__header">Mermaid Preview</div>
    <div class="wmp-preview__body"></div>
  `

  container.insertAdjacentElement("afterend", wrapper)

  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" })
    const { svg } = await mermaid.render(`wmp-${crypto.randomUUID()}`, source)
    wrapper.querySelector(".wmp-preview__body")!.innerHTML = svg
  } catch (error) {
    wrapper.querySelector(".wmp-preview__body")!.innerHTML = `
      <div class="wmp-preview__error">Failed to render Mermaid preview.</div>
    `
    console.error("[wiki-mermaid-preview]", error)
  }
}
```

- [ ] **Step 3: Implement scan orchestration and content-script bootstrap**

```ts
// src/shared/scan.ts
import { processedMarker } from "./dom-markers"
import { extractMermaidSource } from "./extract"
import { looksLikeMermaid } from "./mermaid-detect"
import { renderPreviewBelow } from "./preview"
import type { SelectorRule } from "./types"
import { urlMatchesAnyPattern } from "./url-match"

export async function scanRoot(root: ParentNode, rules: SelectorRule[], currentUrl: string) {
  for (const rule of rules) {
    if (!rule.enabled || !urlMatchesAnyPattern(currentUrl, rule.urlPatterns)) continue

    const candidates = Array.from(root.querySelectorAll(rule.containerSelector))
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue
      if (candidate.getAttribute(processedMarker) === "true") continue

      const source = extractMermaidSource(candidate, rule)
      if (!looksLikeMermaid(source)) continue

      candidate.setAttribute(processedMarker, "true")
      await renderPreviewBelow(candidate, source)
    }
  }
}
```

```ts
// src/content/main.ts
import { loadRules } from "../shared/storage"
import { scanRoot } from "../shared/scan"

async function runScan() {
  const rules = await loadRules()
  await scanRoot(document, rules, window.location.href)
}

void runScan()

const observer = new MutationObserver(() => {
  void runScan()
})

observer.observe(document.body, { childList: true, subtree: true })
```

- [ ] **Step 4: Add scoped preview styles and run the content-script tests**

```css
/* src/content/style.css */
.wmp-preview {
  margin: 12px 0 20px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #fff;
  overflow-x: auto;
}

.wmp-preview__header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #344054;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.wmp-preview__body {
  padding: 12px;
}

.wmp-preview__error {
  color: #b42318;
  font-size: 13px;
}
```

Run: `npm run test -- tests/shared/scan.test.ts`
Expected: the scan test passes and confirms exactly one preview is inserted

- [ ] **Step 5: Commit the content-script rendering flow**

```bash
git add src/content src/shared/preview.ts src/shared/scan.ts tests/shared/scan.test.ts
git commit -m "feat: render mermaid previews in wiki pages"
```

### Task 4: Build The Options Page And Rule Management UI

**Files:**
- Create: `src/options/main.ts`
- Create: `src/options/style.css`
- Create: `src/options/app.ts`
- Modify: `src/shared/storage.ts`

- [ ] **Step 1: Write a failing storage-focused test or manual fixture note for editing rules**

```md
## Manual Options Verification

After implementation:

- open the extension options page
- confirm both default rules appear
- disable one rule and save
- refresh the options page
- confirm the disabled state persists
- add a new selector rule and confirm it persists after refresh
```

- [ ] **Step 2: Expand storage helpers so the options UI can reset and replace rules**

```ts
// src/shared/storage.ts
import { defaultRules } from "./default-rules"
import type { SelectorRule } from "./types"

const storageKey = "selectorRules"

export async function loadRules(): Promise<SelectorRule[]> {
  const result = await chrome.storage.sync.get(storageKey)
  const savedRules = result[storageKey] as SelectorRule[] | undefined
  return savedRules && savedRules.length > 0 ? savedRules : defaultRules
}

export async function saveRules(rules: SelectorRule[]): Promise<void> {
  await chrome.storage.sync.set({ [storageKey]: rules })
}

export async function resetRules(): Promise<void> {
  await chrome.storage.sync.set({ [storageKey]: defaultRules })
}
```

- [ ] **Step 3: Implement a minimal options app that can list, add, edit, delete, enable, and reset rules**

```ts
// src/options/app.ts
import { defaultRules } from "../shared/default-rules"
import { loadRules, resetRules, saveRules } from "../shared/storage"
import type { SelectorRule } from "../shared/types"

function createEmptyRule(): SelectorRule {
  return {
    id: crypto.randomUUID(),
    name: "",
    enabled: true,
    urlPatterns: ["http://internal.example/*"],
    containerSelector: "",
    extractMode: "auto",
    lineSelector: "",
    trimLines: true,
    removeEmptyLines: false
  }
}

export async function mountOptionsApp(root: HTMLElement) {
  let rules = await loadRules()

  function render() {
    root.innerHTML = `
      <div class="options-page">
        <h1>Wiki Mermaid Preview</h1>
        <button data-action="add">Add Rule</button>
        <button data-action="reset">Reset Defaults</button>
        <div class="rule-list">
          ${rules
            .map(
              (rule) => `
                <section class="rule-card" data-rule-id="${rule.id}">
                  <input data-field="name" value="${rule.name}" />
                  <input data-field="patterns" value="${rule.urlPatterns.join(", ")}" />
                  <input data-field="selector" value="${rule.containerSelector}" />
                  <select data-field="extractMode">
                    <option value="auto"${rule.extractMode === "auto" ? " selected" : ""}>auto</option>
                    <option value="innerText"${rule.extractMode === "innerText" ? " selected" : ""}>innerText</option>
                    <option value="joinChildrenText"${rule.extractMode === "joinChildrenText" ? " selected" : ""}>joinChildrenText</option>
                  </select>
                  <input data-field="lineSelector" value="${rule.lineSelector ?? ""}" />
                  <label><input type="checkbox" data-field="enabled"${rule.enabled ? " checked" : ""} /> Enabled</label>
                  <button data-action="save-rule">Save</button>
                  <button data-action="delete-rule">Delete</button>
                </section>
              `
            )
            .join("")}
        </div>
        <p class="options-help">Refresh the wiki page after saving rule changes.</p>
      </div>
    `
  }

  render()

  root.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement
    if (target.dataset.action === "add") {
      rules = [...rules, createEmptyRule()]
      render()
      return
    }
    if (target.dataset.action === "reset") {
      await resetRules()
      rules = await loadRules()
      render()
    }
  })
}
```

- [ ] **Step 4: Wire the options entry and style it enough to be usable**

```ts
// src/options/main.ts
import "./style.css"
import { mountOptionsApp } from "./app"

const root = document.getElementById("app")
if (!root) throw new Error("Options root not found")

void mountOptionsApp(root)
```

```css
/* src/options/style.css */
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
  background: #f8fafc;
}

.options-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.rule-card {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  background: #fff;
}
```

Run: `npm run build`
Expected: the options page compiles without missing imports and the extension bundle still builds

- [ ] **Step 5: Commit the options page**

```bash
git add src/options src/shared/storage.ts options.html
git commit -m "feat: add configurable selector rules options page"
```

### Task 5: Final Verification, Cleanup, And Usage Notes

**Files:**
- Modify: `README.md`
- Modify: `src/content/main.ts`
- Modify: `src/options/app.ts`
- Modify: `tests/setup.ts`

- [ ] **Step 1: Add debounce and mutation-safety cleanup if scans are firing too often**

```ts
// src/content/main.ts
import { loadRules } from "../shared/storage"
import { scanRoot } from "../shared/scan"

let scanTimer: number | undefined

async function runScan() {
  const rules = await loadRules()
  await scanRoot(document, rules, window.location.href)
}

function scheduleScan() {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    void runScan()
  }, 120)
}

void runScan()

const observer = new MutationObserver(() => {
  scheduleScan()
})

observer.observe(document.body, { childList: true, subtree: true })
```

- [ ] **Step 2: Update `README.md` with load-and-test instructions for Chrome**

```md
## Load In Chrome

1. Run `npm install`
2. Run `npm run build`
3. Open `chrome://extensions`
4. Enable Developer mode
5. Choose `Load unpacked`
6. Select the `dist` directory

## Verify On Wiki

1. Open a target page such as `http://internal.example/*`
2. Confirm a Mermaid source block remains visible
3. Confirm a preview appears immediately below it
4. Open extension options and adjust selector rules if a page uses a different DOM shape
5. Refresh the wiki page after saving options changes
```

- [ ] **Step 3: Run the full test suite and build**

Run: `npm run test`
Expected: all Vitest files pass

Run: `npm run build`
Expected: a loadable extension bundle is produced in `dist`

- [ ] **Step 4: Perform manual browser verification**

Run:

```bash
open /Applications/Google\ Chrome.app
```

Manual expected results:

- the extension loads as unpacked without manifest errors
- a Confluence line-by-line Mermaid block renders below the source
- a `pre > code.language-mermaid` block renders below the source
- disabling a rule in options and refreshing the page stops that rule from rendering
- malformed Mermaid shows an error panel instead of breaking the page

- [ ] **Step 5: Commit the verified MVP**

```bash
git add README.md src/content/main.ts src/options/app.ts tests/setup.ts
git commit -m "chore: finalize wiki mermaid preview mvp"
```
