import { describe, expect, it, vi } from "vitest"
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
  it("inserts preview below the whole pre block and stays idempotent", async () => {
    document.body.innerHTML = `
      <pre>
        <code class="language-mermaid">graph TD
  A-->B</code>
      </pre>
    `

    const rules = [
      {
        id: "rule-1",
        name: "rule",
        enabled: true,
        urlPatterns: ["http://example.com/*"],
        containerSelector: "pre > code.language-mermaid",
        extractMode: "innerText",
        trimLines: false,
        removeEmptyLines: false
      }
    ]

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
})
