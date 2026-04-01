import { previewClassName, processedMarker } from "./dom-markers"
import { extractMermaidSource } from "./extract"
import { looksLikeMermaid } from "./mermaid-detect"
import { renderPreviewBelow } from "./preview"
import type { SelectorRule } from "./types"
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

export async function scanRoot(root: Document | Element, rules: SelectorRule[], currentUrl: string) {
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
      await renderPreviewBelow(candidate, source)
    }
  }
}
