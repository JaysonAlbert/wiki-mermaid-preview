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

  it("falls back to text content when auto mode has no matching child lines", () => {
    const container = document.createElement("div")
    container.textContent = "  graph TD\n  A-->B  "

    expect(
      extractMermaidSource(container, {
        extractMode: "auto",
        lineSelector: ".line",
        trimLines: true,
        removeEmptyLines: false
      })
    ).toBe("graph TD\nA-->B")
  })

  it("extracts the first mermaid fenced block from rich text", () => {
    const container = document.createElement("div")
    container.textContent = [
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

    expect(
      extractMermaidSource(container, {
        extractMode: "fencedMermaid",
        trimLines: false,
        removeEmptyLines: false
      })
    ).toBe("flowchart TD\n  A-->B")
  })
})
