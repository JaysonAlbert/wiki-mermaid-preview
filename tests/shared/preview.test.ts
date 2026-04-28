import { describe, expect, it, vi } from "vitest"
import { previewClassName } from "../../src/shared/dom-markers"
import { renderPreviewBelow } from "../../src/shared/preview"

const { mermaidInitialize, mermaidRender } = vi.hoisted(() => ({
  mermaidInitialize: vi.fn(),
  mermaidRender: vi.fn()
}))

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender
  }
}))

describe("renderPreviewBelow", () => {
  it("sanitizes XHTML line breaks in Mermaid SVG output before parsing", async () => {
    mermaidRender.mockResolvedValueOnce({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="120" height="24"><div xmlns="http://www.w3.org/1999/xhtml"><p>line 1<br>line 2</p></div></foreignObject></svg>'
    })

    const container = document.createElement("div")
    container.textContent = "source"
    document.body.append(container)

    await renderPreviewBelow(container, "graph TD\nA-->B")

    const preview = document.querySelector(`.${previewClassName}`)
    const body = preview?.querySelector(".wmp-preview__body")

    expect(preview).toBeTruthy()
    expect(body?.querySelector("svg")).toBeTruthy()
    expect(body?.querySelector("parsererror")).toBeNull()
    expect(body?.querySelector("html")).toBeNull()
    expect(body?.textContent).not.toContain("Failed to render Mermaid preview.")
  })
})
