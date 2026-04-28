import { beforeEach, describe, expect, it, vi } from "vitest"
import { processedMarker, previewClassName } from "../../src/shared/dom-markers"
import { scanRoot } from "../../src/shared/scan"

const { mermaidInitialize, mermaidRender } = vi.hoisted(() => ({
  mermaidInitialize: vi.fn(),
  mermaidRender: vi.fn(async () => ({ svg: "<svg data-testid=\"mermaid\" />" }))
}))

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender
  }
}))

describe("scanRoot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const codeBlockRule = {
    id: "rule-1",
    name: "rule",
    enabled: true,
    urlPatterns: ["http://example.com/*"],
    containerSelector: "pre > code.language-mermaid",
    extractMode: "innerText" as const,
    trimLines: false,
    removeEmptyLines: false
  }

  it("inserts preview below the whole pre block and stays idempotent", async () => {
    document.body.innerHTML = `
      <pre>
        <code class="language-mermaid">graph TD
  A-->B</code>
      </pre>
    `

    const rules = [codeBlockRule]

    await scanRoot(document, rules, "http://example.com/pages/1")
    await scanRoot(document, rules, "http://example.com/pages/1")

    const pre = document.querySelector("pre")
    const code = document.querySelector("code")
    const preview = document.querySelector(`.${previewClassName}`)

    expect(code?.getAttribute(processedMarker)).toBe("true")
    expect(pre?.nextElementSibling).toBe(preview)
    expect(pre?.querySelector(`.${previewClassName}`)).toBeNull()
    expect(document.querySelectorAll(`.${previewClassName}`)).toHaveLength(1)
    expect(mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict" })
    )
  })

  it("keeps code visible and skips rendering in code-only mode", async () => {
    document.body.innerHTML = `
      <pre>
        <code class="language-mermaid">graph TD
  A-->B</code>
      </pre>
    `

    await scanRoot(document, [codeBlockRule], "http://example.com/pages/1", "codeOnly")

    const pre = document.querySelector("pre")
    const code = document.querySelector("code")

    expect(code?.getAttribute(processedMarker)).toBe("true")
    expect(pre?.hidden).toBe(false)
    expect(document.querySelector(`.${previewClassName}`)).toBeNull()
    expect(mermaidRender).not.toHaveBeenCalled()
  })

  it("hides the whole code block after rendering in preview-only mode", async () => {
    document.body.innerHTML = `
      <pre>
        <code class="language-mermaid">graph TD
  A-->B</code>
      </pre>
    `

    await scanRoot(document, [codeBlockRule], "http://example.com/pages/1", "previewOnly")

    const pre = document.querySelector("pre")
    const preview = document.querySelector(`.${previewClassName}`)

    expect(pre?.hidden).toBe(true)
    expect(pre?.nextElementSibling).toBe(preview)
    expect(document.querySelectorAll(`.${previewClassName}`)).toHaveLength(1)
    expect(mermaidRender).toHaveBeenCalled()
  })

  it("skips malformed container selectors without aborting the scan pass", async () => {
    document.body.innerHTML = `
      <div class="container">
        <div class="line">erDiagram</div>
        <div class="line">A ||--o{ B : maps</div>
      </div>
    `

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      scanRoot(
        document,
        [
          {
            id: "bad-rule",
            name: "bad",
            enabled: true,
            urlPatterns: ["http://example.com/*"],
            containerSelector: "div[",
            extractMode: "auto",
            lineSelector: ".line",
            trimLines: true,
            removeEmptyLines: false
          },
          {
            id: "good-rule",
            name: "good",
            enabled: true,
            urlPatterns: ["http://example.com/*"],
            containerSelector: ".container",
            extractMode: "auto",
            lineSelector: ".line",
            trimLines: true,
            removeEmptyLines: false
          }
        ],
        "http://example.com/pages/1"
      )
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll(`.${previewClassName}`)).toHaveLength(1)

    errorSpy.mockRestore()
  })

  it("skips a malformed line selector once per rule without aborting the scan pass", async () => {
    document.body.innerHTML = `
      <div class="bad-target">
        <div class="line">erDiagram</div>
        <div class="line">A ||--o{ B : maps</div>
      </div>
      <div class="bad-target">
        <div class="line">erDiagram</div>
        <div class="line">A ||--o{ B : maps</div>
      </div>
      <div class="good-target">
        <div class="line">erDiagram</div>
        <div class="line">A ||--o{ B : maps</div>
      </div>
    `

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      scanRoot(
        document,
        [
          {
            id: "bad-rule",
            name: "bad",
            enabled: true,
            urlPatterns: ["http://example.com/*"],
            containerSelector: ".bad-target",
            extractMode: "auto",
            lineSelector: "div[",
            trimLines: true,
            removeEmptyLines: false
          },
          {
            id: "good-rule",
            name: "good",
            enabled: true,
            urlPatterns: ["http://example.com/*"],
            containerSelector: ".good-target",
            extractMode: "auto",
            lineSelector: ".line",
            trimLines: true,
            removeEmptyLines: false
          }
        ],
        "http://example.com/pages/1"
      )
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll(`.${previewClassName}`)).toHaveLength(1)

    errorSpy.mockRestore()
  })

  it("renders a preview for a mermaid fenced block inside rich wiki text", async () => {
    document.body.innerHTML = `
      <div class="wiki-content">
        <p id="rich-text-block"></p>
      </div>
    `

    const paragraph = document.getElementById("rich-text-block") as HTMLElement
    paragraph.innerText = [
      "# FastTrsClearingServiceImpl.doCalculate",
      "",
      "说明文字",
      "```mermaid",
      "flowchart TD",
      "  A-->B",
      "```",
      "",
      "更多说明"
    ].join("\n")

    await scanRoot(
      document,
      [
        {
          id: "rich-rule",
          name: "rich",
          enabled: true,
          urlPatterns: ["http://example.com/*"],
          containerSelector: ".wiki-content p",
          extractMode: "fencedMermaid",
          trimLines: false,
          removeEmptyLines: false
        }
      ],
      "http://example.com/pages/1"
    )

    const preview = document.querySelector(`.${previewClassName}`)

    expect(paragraph.getAttribute(processedMarker)).toBe("true")
    expect(paragraph.nextElementSibling).toBe(preview)
    expect(document.querySelectorAll(`.${previewClassName}`)).toHaveLength(1)
    expect(mermaidRender).toHaveBeenLastCalledWith(expect.any(String), "flowchart TD\n  A-->B")
  })
})
