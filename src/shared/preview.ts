import mermaid from "mermaid"
import { previewClassName } from "./dom-markers"
import { createRuntimeId } from "./runtime-id"

function getInsertionTarget(container: Element): Element {
  if (container.parentElement?.tagName === "PRE") {
    return container.parentElement
  }

  return container
}

function setPreviewBodySvg(body: Element, svg: string): void {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml")
  const svgElement = parsed.documentElement

  if (svgElement.tagName.toLowerCase() === "parsererror") {
    throw new Error("Failed to parse Mermaid SVG output.")
  }

  body.replaceChildren(document.importNode(svgElement, true))
}

export async function renderPreviewBelow(container: Element, source: string): Promise<void> {
  const wrapper = document.createElement("div")
  wrapper.className = previewClassName
  wrapper.innerHTML = `
    <div class="wmp-preview__header">Mermaid Preview</div>
    <div class="wmp-preview__body"></div>
  `

  getInsertionTarget(container).insertAdjacentElement("afterend", wrapper)

  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" })
    const { svg } = await mermaid.render(createRuntimeId("wmp"), source)
    setPreviewBodySvg(wrapper.querySelector(".wmp-preview__body")!, svg)
  } catch (error) {
    const errorBox = document.createElement("div")
    errorBox.className = "wmp-preview__error"
    errorBox.textContent = "Failed to render Mermaid preview."
    wrapper.querySelector(".wmp-preview__body")!.replaceChildren(errorBox)
    console.error("[wiki-mermaid-preview]", error)
  }
}
