import type { SelectorRule } from "./types"

export const defaultRules: SelectorRule[] = [
  {
    id: "confluence-line-by-line",
    name: "Confluence line-by-line Mermaid",
    enabled: true,
    urlPatterns: ["*://*/*"],
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
    urlPatterns: ["*://*/*"],
    containerSelector: "pre > code.language-mermaid",
    extractMode: "innerText",
    trimLines: false,
    removeEmptyLines: false
  }
]
