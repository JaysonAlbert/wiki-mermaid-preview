import { previewClassName, processedMarker } from "./dom-markers"
import { extractMermaidSource } from "./extract"
import { looksLikeMermaid } from "./mermaid-detect"
import { renderPreviewBelow } from "./preview"
import type { DisplayMode, SelectorRule } from "./types"
import { urlMatchesAnyPattern } from "./url-match"

function validateLineSelector(rule: SelectorRule): string | undefined | null {
  if (rule.extractMode !== "auto" && rule.extractMode !== "joinChildrenText") {
    return rule.lineSelector
  }

  if (!rule.lineSelector) {
    return undefined
  }

  try {
    document.createElement("div").querySelectorAll(rule.lineSelector)
    return rule.lineSelector
  } catch (error) {
    console.error("[wiki-mermaid-preview]", error)
    return null
  }
}

function queryCandidates(root: Document | Element, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector))
  } catch (error) {
    console.error("[wiki-mermaid-preview]", error)
    return []
  }
}

function getSourceDisplayTarget(container: Element): HTMLElement | null {
  if (container.parentElement instanceof HTMLElement && container.parentElement.tagName === "PRE") {
    return container.parentElement
  }

  return container instanceof HTMLElement ? container : null
}

export async function scanRoot(
  root: Document | Element,
  rules: SelectorRule[],
  currentUrl: string,
  displayMode: DisplayMode = "codeAndPreview"
) {
  for (const rule of rules) {
    if (!rule.enabled || !urlMatchesAnyPattern(currentUrl, rule.urlPatterns)) {
      continue
    }

    const lineSelector = validateLineSelector(rule)
    if (lineSelector === null) {
      continue
    }

    const candidates = queryCandidates(root, rule.containerSelector)
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue
      }

      if (candidate.classList.contains(previewClassName)) {
        continue
      }

      if (candidate.getAttribute(processedMarker) === "true") {
        continue
      }

      let source: string
      try {
        source = extractMermaidSource(candidate, {
          ...rule,
          lineSelector
        })
      } catch (error) {
        console.error("[wiki-mermaid-preview]", error)
        continue
      }

      if (!looksLikeMermaid(source)) {
        continue
      }

      candidate.setAttribute(processedMarker, "true")
      if (displayMode === "codeOnly") {
        continue
      }

      await renderPreviewBelow(candidate, source)
      if (displayMode === "previewOnly") {
        const sourceDisplayTarget = getSourceDisplayTarget(candidate)
        if (sourceDisplayTarget) {
          sourceDisplayTarget.hidden = true
        }
      }
    }
  }
}
